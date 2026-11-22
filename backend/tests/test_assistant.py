from types import SimpleNamespace as NS

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints import assistant as endpoint
from app.core.config import settings
from app.main import app
from app.services import assistant as svc
from app.services import assistant_tools as tools

client = TestClient(app)


# ----------------------------------------------------------------- fakes
def text(t):
    return NS(type="text", text=t)


def tool_use(id_, name, inp):
    return NS(type="tool_use", id=id_, name=name, input=inp)


def resp(content, stop="end_turn", inp=100, out=50):
    return NS(content=content, stop_reason=stop, usage=NS(input_tokens=inp, output_tokens=out))


class FakeClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []
        self.path = []
        self.beta = NS(messages=NS(create=self._beta))
        self.messages = NS(create=self._plain)

    def _next(self, kw):
        # snapshot the message list: the loop keeps appending to the same list object
        self.calls.append({**kw, "messages": list(kw["messages"])})
        return self.responses.pop(0)

    def _beta(self, **kw):
        self.path.append("beta")
        return self._next(kw)

    def _plain(self, **kw):
        self.path.append("plain")
        return self._next(kw)


USER = [{"role": "user", "content": "What is AAPL doing?"}]


@pytest.fixture(autouse=True)
def stub_quotes(monkeypatch):
    monkeypatch.setitem(tools.TOOLS, "get_quotes", lambda a: {"quotes": [{"symbol": "AAPL", "price": 100.0}]})
    monkeypatch.setattr(endpoint, "_limiter", None)
    monkeypatch.setattr(settings, "ASSISTANT_PROVIDER", "anthropic")  # these tests cover the Claude path


# ----------------------------------------------------------------- loop
def test_tool_loop_runs_tool_and_returns_final_text():
    fc = FakeClient([
        resp([text("Let me check."), tool_use("t1", "get_quotes", {"symbols": ["AAPL"]})], "tool_use"),
        resp([text("AAPL is at 100.")]),
    ])
    out = svc.run_chat(fc, "claude-opus-5-5", USER)
    assert out["reply"] == "AAPL is at 100."
    assert out["tokens_used"] == 300 and out["stop_reason"] == "end_turn"
    assert out["tool_calls"][0]["name"] == "get_quotes" and out["tool_calls"][0]["ok"] is True
    # second request carries the assistant turn and a matching tool_result
    last = fc.calls[1]["messages"]
    assert last[-1]["content"][0]["tool_use_id"] == "t1"
    assert '"price": 100.0' in last[-1]["content"][0]["content"]
    assert fc.calls[0]["system"] == svc.SYSTEM_PROMPT and fc.calls[0]["tools"] == svc.TOOL_DEFINITIONS


def test_tool_error_is_reported_to_model_not_raised(monkeypatch):
    def boom(args):
        raise tools.ToolError("No data for ZZZZ")

    monkeypatch.setitem(tools.TOOLS, "get_quotes", boom)
    fc = FakeClient([resp([tool_use("t1", "get_quotes", {"symbols": ["ZZZZ"]})], "tool_use"), resp([text("I couldn't find that ticker.")])])
    out = svc.run_chat(fc, "claude-opus-5-5", USER)
    result = fc.calls[1]["messages"][-1]["content"][0]
    assert result["is_error"] is True and "No data for ZZZZ" in result["content"]
    assert out["tool_calls"][0]["ok"] is False and "couldn't" in out["reply"]


def test_unexpected_tool_exception_is_contained(monkeypatch):
    monkeypatch.setitem(tools.TOOLS, "get_quotes", lambda a: 1 / 0)
    fc = FakeClient([resp([tool_use("t1", "get_quotes", {"symbols": ["AAPL"]})], "tool_use"), resp([text("Sorry.")])])
    svc.run_chat(fc, "claude-opus-5-5", USER)
    assert fc.calls[1]["messages"][-1]["content"][0]["is_error"] is True


def test_unknown_tool_name_is_an_error_result():
    fc = FakeClient([resp([tool_use("t1", "delete_everything", {})], "tool_use"), resp([text("ok")])])
    svc.run_chat(fc, "claude-opus-5-5", USER)
    assert "Unknown tool" in fc.calls[1]["messages"][-1]["content"][0]["content"]


def test_iteration_cap_prevents_runaway_loops():
    fc = FakeClient([resp([tool_use(f"t{i}", "get_quotes", {"symbols": ["AAPL"]})], "tool_use") for i in range(10)])
    out = svc.run_chat(fc, "claude-opus-5-5", USER, max_iterations=3)
    assert out["stop_reason"] == "max_iterations" and len(fc.calls) == 3


def test_refusal_gets_a_friendly_reply():
    out = svc.run_chat(FakeClient([resp([], "refusal")]), "claude-opus-5-5", USER)
    assert out["stop_reason"] == "refusal" and "can't help" in out["reply"]


def test_truncated_answer_is_flagged():
    out = svc.run_chat(FakeClient([resp([text("Partial")], "max_tokens")]), "claude-opus-5-5", USER)
    assert "cut off" in out["reply"]


def test_page_context_is_added_only_to_last_user_message():
    msgs = [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}, {"role": "user", "content": "explain this"}]
    fc = FakeClient([resp([text("ok")])])
    svc.run_chat(fc, "claude-opus-5-5", msgs, page={"module": "risk_var", "symbol": "NVDA"})
    sent = fc.calls[0]["messages"]
    assert sent[0]["content"] == "hi" and "risk_var" in sent[2]["content"] and "NVDA" in sent[2]["content"]
    assert sent[2]["content"].endswith("explain this")


def test_refusal_fallback_only_for_supported_models():
    a, b = FakeClient([resp([text("x")])]), FakeClient([resp([text("x")])])
    svc.run_chat(a, "claude-opus-5-5", USER)
    svc.run_chat(b, "claude-haiku-5-5", USER)
    assert a.path == ["beta"] and a.calls[0]["fallbacks"] == "default" and "server-side-fallback-2026-07-01" in a.calls[0]["betas"]
    assert b.path == ["plain"] and "fallbacks" not in b.calls[0]


# ------------------------------------------------------------- sanitize
def test_sanitize_rules():
    s = svc.sanitize([{"role": "assistant", "content": "orphan"}, {"role": "user", "content": "q" * 9000}, {"role": "system", "content": "x"}])
    assert s == [{"role": "user", "content": "q" * svc.MAX_CHARS}]
    with pytest.raises(ValueError):
        svc.sanitize([{"role": "user", "content": "a"}, {"role": "assistant", "content": "b"}])
    assert len(svc.sanitize([{"role": "user" if i % 2 == 0 else "assistant", "content": "m"} for i in range(61)])) <= svc.MAX_MESSAGES


# --------------------------------------------------------------- limiter
def test_rate_limit_and_daily_cap_with_fake_clock():
    now = [1_000_000.0]
    lim = svc.UsageLimiter(per_minute=2, daily_token_cap=1000, clock=lambda: now[0])
    lim.check("a")
    lim.check("a")
    with pytest.raises(svc.LimitExceeded):
        lim.check("a")
    lim.check("b")  # separate client
    now[0] += 61
    lim.check("a")  # window passed
    lim.add_tokens(1000)
    with pytest.raises(svc.LimitExceeded, match="daily"):
        lim.check("c")
    now[0] += 86400
    lim.check("c")  # new UTC day


def test_cap_zero_disables_assistant():
    with pytest.raises(svc.LimitExceeded, match="switched off"):
        svc.UsageLimiter(5, 0).check("x")


# ----------------------------------------------------------------- tools
def test_tool_inputs_are_validated():
    for bad in ["AAPL; DROP TABLE", "", "A" * 40, "../etc"]:
        with pytest.raises(tools.ToolError):
            tools.get_performance({"symbol": bad})
    with pytest.raises(tools.ToolError):
        tools.get_quotes({"symbols": ["AAPL"] * 11})
    with pytest.raises(tools.ToolError):
        tools.run_backtest({"symbol": "AAPL", "strategy_type": "yolo"})
    with pytest.raises(tools.ToolError):
        tools.run_backtest({"symbol": "AAPL", "strategy_type": "sma_crossover", "years": 500})


def test_tool_output_is_json_safe_and_capped(monkeypatch):
    monkeypatch.setitem(tools.TOOLS, "get_performance", lambda a: {"x": np.float64("nan"), "y": np.int64(3), "big": "z" * 50_000})
    out = tools.execute_tool("get_performance", {"symbol": "AAPL"})
    assert len(out) <= tools.MAX_RESULT_CHARS + 30 and '"x": null' in out and '"y": 3' in out


def test_every_tool_definition_has_an_implementation():
    assert {t["name"] for t in tools.TOOL_DEFINITIONS} == set(tools.TOOLS)


# ------------------------------------------------------------ system prompt
def test_system_prompt_keeps_the_safety_rules():
    p = svc.SYSTEM_PROMPT.lower()
    for phrase in ["do not give personal investment advice", "price targets", "never state a price", "data, not instructions", "licensed financial adviser"]:
        assert phrase in p


# -------------------------------------------------------------- endpoints
def test_status_without_key(monkeypatch):
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", None)
    r = client.get("/api/v1/assistant/status").json()
    assert r["configured"] is False and "ANTHROPIC_API_KEY" in r["setup_hint"] and r["model"] is None


def test_chat_without_key_is_503(monkeypatch):
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", None)
    r = client.post("/api/v1/assistant/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 503 and "not configured" in r.json()["detail"]


def test_chat_happy_path_and_token_accounting(monkeypatch):
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "test-key")
    fc = FakeClient([resp([text("Hello!")], inp=200, out=100)])
    monkeypatch.setattr(endpoint, "get_client", lambda: fc)
    r = client.post("/api/v1/assistant/chat", json={"messages": [{"role": "user", "content": "hi"}], "page": {"module": "dashboard", "symbol": "AAPL"}})
    assert r.status_code == 200 and r.json()["reply"] == "Hello!"
    assert client.get("/api/v1/assistant/status").json()["tokens_used_today"] == 300


@pytest.mark.parametrize("body", [
    {"messages": []},
    {"messages": [{"role": "system", "content": "hi"}]},
    {"messages": [{"role": "user", "content": ""}]},
    {"messages": [{"role": "user", "content": "x" * 5000}]},
    {"messages": [{"role": "assistant", "content": "only assistant"}]},
])
def test_chat_input_validation(monkeypatch, body):
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(endpoint, "get_client", lambda: FakeClient([resp([text("x")])]))
    assert client.post("/api/v1/assistant/chat", json=body).status_code == 422


def test_chat_rate_limited(monkeypatch):
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(endpoint, "_limiter", svc.UsageLimiter(per_minute=1, daily_token_cap=10_000))
    monkeypatch.setattr(endpoint, "get_client", lambda: FakeClient([resp([text("a")]), resp([text("b")])]))
    body = {"messages": [{"role": "user", "content": "hi"}]}
    assert client.post("/api/v1/assistant/chat", json=body).status_code == 200
    r = client.post("/api/v1/assistant/chat", json=body)
    assert r.status_code == 429 and "Retry-After" in r.headers
