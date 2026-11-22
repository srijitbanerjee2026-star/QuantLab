"""Beginner assistant endpoints. Two providers: Claude (cloud, needs a key) or a free local model via Ollama."""
import threading
from typing import Any, Optional

import anthropic
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services import assistant as svc
from app.services import assistant_local as local

router = APIRouter()

_client: Optional[anthropic.Anthropic] = None
_limiter: Optional[svc.UsageLimiter] = None
_local_limiter: Optional[svc.UsageLimiter] = None
_local_busy = threading.Lock()  # one local generation at a time: the model is large relative to RAM


def get_client() -> Any:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=120.0, max_retries=2)
    return _client


def get_limiter() -> svc.UsageLimiter:
    global _limiter
    if _limiter is None:
        _limiter = svc.UsageLimiter(settings.ASSISTANT_REQUESTS_PER_MINUTE, settings.ASSISTANT_DAILY_TOKEN_CAP)
    return _limiter


def get_local_limiter() -> svc.UsageLimiter:
    global _local_limiter
    if _local_limiter is None:  # local inference is free: only the per-minute limit applies
        _local_limiter = svc.UsageLimiter(settings.ASSISTANT_REQUESTS_PER_MINUTE, 10**12)
    return _local_limiter


def resolve_provider() -> str:
    p = (settings.ASSISTANT_PROVIDER or "auto").lower()
    if p in ("anthropic", "ollama"):
        return p
    return "anthropic" if settings.ANTHROPIC_API_KEY else "ollama"


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=svc.MAX_CHARS)


class PageContext(BaseModel):
    module: Optional[str] = Field(default=None, max_length=40)
    symbol: Optional[str] = Field(default=None, max_length=15)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=svc.MAX_MESSAGES)
    page: Optional[PageContext] = None


@router.get("/status")
def status():
    provider = resolve_provider()
    lim = get_limiter()
    base = {"provider": provider, "tokens_used_today": lim.used_today(), "daily_token_cap": settings.ASSISTANT_DAILY_TOKEN_CAP}
    if provider == "anthropic":
        ready = bool(settings.ANTHROPIC_API_KEY)
        return {**base, "configured": ready, "ready": ready, "model": settings.ASSISTANT_MODEL if ready else None,
                "setup_hint": None if ready else "Add ANTHROPIC_API_KEY=<your key> to backend/.env and restart the backend."}
    st = local.ollama_status(settings.OLLAMA_BASE_URL, settings.OLLAMA_MODEL)
    return {**base, "configured": st["ready"], "ready": st["ready"], "model": settings.OLLAMA_MODEL if st["ready"] else None,
            "setup_hint": st["hint"], "local": True}


def _http(status_code: int, detail: str, retry: Optional[int] = None) -> HTTPException:
    return HTTPException(status_code=status_code, detail=detail, headers={"Retry-After": str(retry)} if retry else None)


@router.post("/chat")
def chat(payload: ChatRequest, request: Request):
    provider = resolve_provider()
    who = request.client.host if request.client else "unknown"

    if provider == "anthropic" and not settings.ANTHROPIC_API_KEY:
        raise _http(503, "The assistant is not configured. Add ANTHROPIC_API_KEY to backend/.env and restart the backend.")

    limiter = get_limiter() if provider == "anthropic" else get_local_limiter()
    try:
        limiter.check(who)
        convo = svc.sanitize([m.model_dump() for m in payload.messages])
    except svc.LimitExceeded as e:
        raise _http(429, str(e), e.retry_after)
    except ValueError as e:
        raise _http(422, str(e))
    page = payload.page.model_dump() if payload.page else None

    if provider == "ollama":
        if not _local_busy.acquire(blocking=False):
            raise _http(429, "The local model is busy answering another question. Please wait a moment.", 10)
        try:
            return local.run_local_chat(settings.OLLAMA_BASE_URL, settings.OLLAMA_MODEL, convo, page)
        except local.LocalUnavailable as e:
            raise _http(503, str(e))
        finally:
            _local_busy.release()

    try:
        out = svc.run_chat(get_client(), settings.ASSISTANT_MODEL, convo, page)
    except anthropic.AuthenticationError:
        raise _http(502, "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in backend/.env.")
    except anthropic.PermissionDeniedError:
        raise _http(502, "The Anthropic API key does not have access to the configured model.")
    except anthropic.NotFoundError:
        raise _http(502, f"The model '{settings.ASSISTANT_MODEL}' was not found. Check ASSISTANT_MODEL in backend/.env.")
    except anthropic.RateLimitError:
        raise _http(429, "The AI provider is rate limiting requests. Please try again shortly.", 30)
    except anthropic.APIConnectionError:
        raise _http(502, "Could not reach the AI provider. Check your internet connection.")
    except anthropic.APIStatusError as e:
        raise _http(502, f"The AI provider returned an error ({e.status_code}).")
    limiter.add_tokens(out["tokens_used"])
    return out
