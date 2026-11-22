"""Tools the beginner assistant may call. Every tool reads REAL data through QuantLab's own engines.

Design rules
- Results are compact (the model needs conclusions, not 5-year series) and JSON-serialisable.
- Inputs are validated here, never trusted from the model.
- Failures raise ToolError with a message the model can relay to the user; nothing is fabricated.
"""
from __future__ import annotations

import json
import re
from typing import Any, Callable

import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import HTTPException

from app.services.backtest_engine import STRATEGIES, simulate
from app.services.price_loader import load_closes, load_full_ohlcv, load_ohlcv
from app.services.risk_engine import risk_report
from app.services.technicals_engine import compute as compute_technicals, rsi as wilder_rsi

MAX_RESULT_CHARS = 7000
_SYMBOL = re.compile(r"^[A-Za-z0-9.\-=^]{1,15}$")


class ToolError(Exception):
    """A problem the model should explain to the user (bad symbol, provider down, ...)."""


def _symbol(value: Any) -> str:
    s = str(value or "").strip().upper()
    if not _SYMBOL.match(s):
        raise ToolError(f"'{value}' is not a valid ticker symbol.")
    return s


def _num(value: Any, name: str, lo: float, hi: float, default: float) -> float:
    if value is None:
        return default
    try:
        v = float(value)
    except (TypeError, ValueError):
        raise ToolError(f"{name} must be a number.")
    if not lo <= v <= hi:
        raise ToolError(f"{name} must be between {lo} and {hi}.")
    return v


def _unwrap(fn: Callable[[], Any]) -> Any:
    """Run an endpoint-style function and turn HTTP/provider errors into ToolError."""
    try:
        return fn()
    except HTTPException as e:
        raise ToolError(str(e.detail))
    except ToolError:
        raise
    except ValueError as e:
        raise ToolError(str(e))
    except Exception as e:  # provider/network problems
        raise ToolError(f"The data provider failed: {type(e).__name__}")


# ------------------------------------------------------------------ tools
def search_symbol(args: dict) -> dict:
    q = str(args.get("query", "")).strip()[:40]
    if not q:
        raise ToolError("query is required.")

    def go():
        res = yf.Search(q, max_results=8, news_count=0)
        return [
            {"symbol": r.get("symbol"), "name": r.get("longname") or r.get("shortname"), "exchange": r.get("exchDisp"), "type": r.get("quoteType")}
            for r in (res.quotes or [])
            if r.get("symbol")
        ]

    return {"results": _unwrap(go)}


def get_quotes(args: dict) -> dict:
    from app.api.v1.endpoints import market

    syms = args.get("symbols") or []
    if not isinstance(syms, list) or not 1 <= len(syms) <= 10:
        raise ToolError("symbols must be a list of 1 to 10 tickers.")
    clean = [_symbol(s) for s in syms]
    data = _unwrap(lambda: market.quotes(symbols=",".join(clean)))
    return {
        "freshness": "delayed (not real-time)",
        "quotes": [{k: q.get(k) for k in ("symbol", "price", "change", "change_pct", "volume", "as_of", "error")} for q in data["quotes"]],
    }


def get_performance(args: dict) -> dict:
    from app.api.v1.endpoints import market

    sym = _symbol(args.get("symbol"))
    return _unwrap(lambda: market.performance(sym))


def get_risk_summary(args: dict) -> dict:
    sym = _symbol(args.get("symbol"))
    bench = _symbol(args.get("benchmark") or "SPY")
    years = _num(args.get("years"), "years", 0.5, 10, 3)

    def go():
        closes = load_closes([sym] + ([bench] if bench != sym else []), years)
        rets = closes.pct_change().dropna(how="any") if bench != sym else closes.pct_change().dropna()
        rep = risk_report(rets[sym], rets[bench] if bench != sym else None, 0.02)
        keep = ("start", "end", "observations", "annualized_return", "annualized_volatility", "sharpe_ratio", "sortino_ratio",
                "max_drawdown", "max_drawdown_peak", "max_drawdown_trough", "skewness", "excess_kurtosis", "best_day", "worst_day", "cvar_95")
        out = {k: rep[k] for k in keep}
        out["var_1day"] = {c: rep["var"][c]["historical"] for c in ("90", "95", "99")}
        out["benchmark"] = {"symbol": bench, **rep["benchmark"]} if rep["benchmark"] else None
        out["note"] = "Returns are fractions (0.05 = 5%). Historical measures, not forecasts."
        return out

    return _unwrap(go)


def get_technical_summary(args: dict) -> dict:
    sym = _symbol(args.get("symbol"))
    return _unwrap(lambda: {"symbol": sym, **compute_technicals(load_full_ohlcv(sym, 2.0))["summary"]})


def get_seasonality(args: dict) -> dict:
    from app.services.seasonality_engine import analyse

    sym = _symbol(args.get("symbol"))

    def go():
        r = analyse(load_ohlcv(sym, 30.0)["Close"])
        return {
            "symbol": sym,
            "months_of_history": r["n_months"],
            "best_month": r["best_month"],
            "worst_month": r["worst_month"],
            "months_statistically_significant": r["n_significant"],
            "by_month": [{k: m[k] for k in ("month", "avg_return_pct", "win_rate_pct", "t_stat")} for m in r["months"]],
            "note": "With 12 months tested, about 0.6 appear significant by chance alone.",
        }

    return _unwrap(go)


def get_macro_snapshot(args: dict) -> dict:
    from app.api.v1.endpoints import analysis

    m = _unwrap(lambda: analysis.macro())
    return {
        "yield_curve_pct": {p["maturity"]: p["yield_pct"] for p in m["curve"]["points"]},
        "yield_curve_as_of": m["curve"]["as_of"],
        "spread_10y_minus_2y": m["spread_2s10s_now"],
        "fed_funds_rate": m["fed_funds"],
        "inflation_cpi_yoy": m["inflation_yoy"],
        "unemployment_rate": m["unemployment"]["latest"],
        "sahm_rule": {**(m["sahm"]["latest"] or {}), "triggered": m["sahm"]["triggered"], "trigger_level": m["sahm"]["threshold"]},
        "recession_probability_model": m["recession_probability"]["latest"],
        "source": "FRED (St. Louis Fed)",
    }


def get_options_summary(args: dict) -> dict:
    from app.api.v1.endpoints import analysis

    sym = _symbol(args.get("symbol"))
    o = _unwrap(lambda: analysis.options(sym, None))
    keep = ("symbol", "expiration", "days_to_expiry", "spot", "atm_iv", "expected_move_1sd", "expected_move_pct", "put_call_oi_ratio",
            "put_call_volume_ratio", "net_gex", "gamma_flip", "call_wall", "put_wall", "max_pain", "assumptions")
    out = {k: o[k] for k in keep}
    out["term_structure_atm_iv"] = [{"days": t["days"], "atm_iv": t["atm_iv"]} for t in o["term_structure"]]
    out["freshness"] = "delayed"
    return out


def run_backtest(args: dict) -> dict:
    sym = _symbol(args.get("symbol"))
    strategy = str(args.get("strategy_type", "sma_crossover"))
    if strategy not in STRATEGIES:
        raise ToolError(f"strategy_type must be one of {sorted(STRATEGIES)}.")
    years = _num(args.get("years"), "years", 1, 15, 5)
    cost = _num(args.get("cost_bps"), "cost_bps", 0, 100, 5)
    capital = _num(args.get("initial_capital"), "initial_capital", 100, 1e9, 10000)
    short_w = int(_num(args.get("short_window"), "short_window", 2, 200, 20))
    long_w = int(_num(args.get("long_window"), "long_window", 3, 400, 50))
    rsi_low = _num(args.get("rsi_low"), "rsi_low", 1, 49, 30)
    rsi_high = _num(args.get("rsi_high"), "rsi_high", 51, 99, 70)

    def go():
        px = load_full_ohlcv(sym, years + 1.5)
        close = px["Close"]
        df = pd.DataFrame({"date": px.index, "adj_close": close.values, "simple_return": close.pct_change().values, "rsi_14": wilder_rsi(close).values})
        start = (pd.Timestamp.today() - pd.DateOffset(years=int(years))).strftime("%Y-%m-%d")
        sim, trades, m = simulate(df, strategy, capital, short_w, long_w, rsi_low, rsi_high, cost, start=start)
        closed = [t for t in trades if not t["open"]]
        return {
            "symbol": sym, "strategy": strategy, "period": f"{str(sim['date'].iloc[0])[:10]} to {str(sim['date'].iloc[-1])[:10]}",
            "parameters": {"short_window": short_w, "long_window": long_w, "rsi_low": rsi_low, "rsi_high": rsi_high, "cost_bps_per_side": cost},
            "metrics": m, "recent_trades": closed[-5:],
            "note": "Long/flat only, trades execute on the next bar, adjusted closes. Compare total_return_pct with buy_hold_return_pct. Past results do not predict the future.",
        }

    return _unwrap(go)


TOOLS: dict[str, Callable[[dict], dict]] = {
    "search_symbol": search_symbol,
    "get_quotes": get_quotes,
    "get_performance": get_performance,
    "get_risk_summary": get_risk_summary,
    "get_technical_summary": get_technical_summary,
    "get_seasonality": get_seasonality,
    "get_macro_snapshot": get_macro_snapshot,
    "get_options_summary": get_options_summary,
    "run_backtest": run_backtest,
}

_SYM = {"type": "string", "description": "Ticker symbol, e.g. AAPL, SPY, BTC-USD, ^GSPC"}

TOOL_DEFINITIONS: list[dict] = [
    {"name": "search_symbol", "description": "Find ticker symbols from a company or fund name.",
     "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}},
    {"name": "get_quotes", "description": "Latest delayed price, daily change and volume for up to 10 tickers.",
     "input_schema": {"type": "object", "properties": {"symbols": {"type": "array", "items": _SYM, "maxItems": 10}}, "required": ["symbols"]}},
    {"name": "get_performance", "description": "Trailing returns (1D to 3Y, YTD), 52-week range, 1-year volatility and max drawdown for a ticker.",
     "input_schema": {"type": "object", "properties": {"symbol": _SYM}, "required": ["symbol"]}},
    {"name": "get_risk_summary", "description": "Risk report: volatility, Sharpe, Sortino, max drawdown, VaR/CVaR, beta and alpha versus a benchmark.",
     "input_schema": {"type": "object", "properties": {"symbol": _SYM, "benchmark": {"type": "string", "description": "default SPY"}, "years": {"type": "number", "description": "lookback, 0.5-10, default 3"}}, "required": ["symbol"]}},
    {"name": "get_technical_summary", "description": "Current technical read-out: trend vs 50/200-day averages, RSI, MACD, Bollinger %B, ATR, volume.",
     "input_schema": {"type": "object", "properties": {"symbol": _SYM}, "required": ["symbol"]}},
    {"name": "get_seasonality", "description": "Average return and win rate by calendar month over up to 30 years, with significance.",
     "input_schema": {"type": "object", "properties": {"symbol": _SYM}, "required": ["symbol"]}},
    {"name": "get_macro_snapshot", "description": "US macro snapshot from FRED: Treasury yields, 10Y-2Y spread, Fed funds rate, CPI inflation, unemployment, Sahm rule, recession-probability model.",
     "input_schema": {"type": "object", "properties": {}}},
    {"name": "get_options_summary", "description": "Options snapshot for the nearest standard expiry: implied volatility, expected move, put/call ratio, walls, max pain. Only for optionable symbols.",
     "input_schema": {"type": "object", "properties": {"symbol": _SYM}, "required": ["symbol"]}},
    {"name": "run_backtest", "description": "Backtest a simple rule on real history and compare with buy-and-hold. strategy_type is 'sma_crossover' (long when the fast average is above the slow one) or 'rsi_mean_reversion' (buy when RSI is below rsi_low, sell above rsi_high).",
     "input_schema": {"type": "object", "properties": {
         "symbol": _SYM, "strategy_type": {"type": "string", "enum": sorted(STRATEGIES)},
         "years": {"type": "number", "description": "history to test, 1-15, default 5"},
         "short_window": {"type": "integer"}, "long_window": {"type": "integer"},
         "rsi_low": {"type": "number"}, "rsi_high": {"type": "number"},
         "cost_bps": {"type": "number", "description": "cost per side in basis points, default 5"},
         "initial_capital": {"type": "number"}}, "required": ["symbol", "strategy_type"]}},
]


def _clean(obj: Any) -> Any:
    """Make numpy/pandas values JSON-safe and replace NaN/inf with None."""
    if isinstance(obj, dict):
        return {str(k): _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    if isinstance(obj, (np.floating, float)):
        return None if not np.isfinite(obj) else float(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, (pd.Timestamp,)):
        return str(obj)[:10]
    return obj


def run_tool(name: str, args: Any) -> dict:
    """Run a tool and return its cleaned result as a dict. Raises ToolError for user-explainable failures."""
    fn = TOOLS.get(name)
    if fn is None:
        raise ToolError(f"Unknown tool '{name}'.")
    if not isinstance(args, dict):
        raise ToolError("Tool input must be an object.")
    return _clean(fn(args))


def execute_tool(name: str, args: Any) -> str:
    """Run a tool and return a JSON string (capped in size). Raises ToolError for user-explainable failures."""
    text = json.dumps(run_tool(name, args), default=str)
    if len(text) > MAX_RESULT_CHARS:
        text = text[:MAX_RESULT_CHARS] + '..."[truncated]"'
    return text
