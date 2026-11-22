"""Symbol-agnostic market data (any ticker Yahoo Finance knows). Not tied to the database."""
import time
from typing import Any, Callable, Optional

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, HTTPException, Query

from app.services.market_stats import compute_performance

router = APIRouter()

_CACHE: dict[tuple, tuple[float, Any]] = {}

# Valid yfinance (period, interval) pairs we expose
_PERIODS = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "max"}
_INTERVALS = {"1m", "5m", "15m", "30m", "60m", "1d", "1wk", "1mo"}
_INTRADAY = {"1m", "5m", "15m", "30m", "60m"}


def _cached(key: tuple, ttl: int, fn: Callable[[], Any]) -> Any:
    hit = _CACHE.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    value = fn()
    _CACHE[key] = (time.time(), value)
    return value


@router.get("/history/{symbol}")
def history(
    symbol: str,
    period: str = Query("6mo"),
    interval: str = Query("1d"),
):
    """OHLCV candles for any ticker. Intraday intervals are delayed (~15 min) by Yahoo."""
    symbol = symbol.upper().strip()
    if period not in _PERIODS or interval not in _INTERVALS:
        raise HTTPException(status_code=400, detail="Unsupported period or interval")
    ttl = 30 if interval in _INTRADAY else 300

    def fetch():
        df = yf.Ticker(symbol).history(period=period, interval=interval, auto_adjust=False)
        if df is None or df.empty:
            return None
        rows = []
        for ts, r in df.iterrows():
            rows.append({
                "time": int(ts.timestamp()) if interval in _INTRADAY else ts.strftime("%Y-%m-%d"),
                "open": round(float(r["Open"]), 4),
                "high": round(float(r["High"]), 4),
                "low": round(float(r["Low"]), 4),
                "close": round(float(r["Close"]), 4),
                "volume": int(r["Volume"]) if r["Volume"] == r["Volume"] else 0,
            })
        return rows

    try:
        rows = _cached(("hist", symbol, period, interval), ttl, fetch)
    except Exception as e:  # network / provider errors
        raise HTTPException(status_code=502, detail=f"Market data provider error: {e}")
    if not rows:
        raise HTTPException(status_code=404, detail=f"No data for symbol {symbol}")
    return {
        "symbol": symbol,
        "period": period,
        "interval": interval,
        "source": "yfinance",
        "freshness": "delayed" if interval in _INTRADAY else "historical",
        "candles": rows,
    }


def _quote_from_frame(sym: str, df) -> Optional[dict]:
    df = df.dropna(subset=["Close"])
    if df is None or len(df) < 2:
        return None
    last, prev = float(df["Close"].iloc[-1]), float(df["Close"].iloc[-2])
    return {
        "symbol": sym,
        "price": round(last, 4),
        "change": round(last - prev, 4),
        "change_pct": round((last / prev - 1) * 100, 3),
        "volume": int(df["Volume"].iloc[-1]) if df["Volume"].iloc[-1] == df["Volume"].iloc[-1] else 0,
        "spark": [round(float(x), 4) for x in df["Close"].tail(30)],
        "as_of": df.index[-1].strftime("%Y-%m-%d"),
    }


@router.get("/quotes")
def quotes(symbols: str = Query(..., description="Comma separated tickers")):
    """Latest price, change and volume for a list of tickers (delayed). Uses one batched download."""
    syms = list(dict.fromkeys(s.strip().upper() for s in symbols.split(",") if s.strip()))[:60]
    result: dict[str, Optional[dict]] = {}
    missing = []
    for s in syms:
        hit = _CACHE.get(("quote", s))
        if hit and time.time() - hit[0] < 60:
            result[s] = hit[1]
        else:
            missing.append(s)

    if missing:
        try:
            raw = yf.download(
                missing, period="1mo", interval="1d", auto_adjust=False,
                group_by="ticker", progress=False, threads=True,
            )
        except Exception:
            raw = None
        for s in missing:
            q = None
            try:
                if raw is not None and not raw.empty:
                    frame = raw[s] if len(missing) > 1 else raw
                    if len(missing) == 1 and hasattr(frame.columns, "levels"):
                        frame = frame[s] if s in frame.columns.get_level_values(0) else frame.droplevel(0, axis=1)
                    q = _quote_from_frame(s, frame)
            except Exception:
                q = None
            _CACHE[("quote", s)] = (time.time(), q)
            result[s] = q

    out = [result.get(s) or {"symbol": s, "error": "unavailable"} for s in syms]
    return {"source": "yfinance", "freshness": "delayed", "quotes": out}


@router.get("/performance/{symbol}")
def performance(symbol: str):
    """Trailing returns, 52-week range and 1y risk, computed from adjusted daily closes."""
    symbol = symbol.upper().strip()

    def fetch():
        df = yf.Ticker(symbol).history(period="5y", interval="1d", auto_adjust=True)
        if df is None or df.empty:
            return None
        s = df["Close"]
        s.index = pd.to_datetime(s.index).tz_localize(None)
        return compute_performance(s)

    try:
        res = _cached(("perf", symbol), 600, fetch)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Market data provider error: {e}")
    if not res:
        raise HTTPException(status_code=404, detail=f"No data for symbol {symbol}")
    return {"symbol": symbol, "source": "yfinance (adjusted close)", **res}


@router.get("/profile/{symbol}")
def profile(symbol: str):
    """Instrument metadata. Fields the provider does not supply are null."""
    symbol = symbol.upper().strip()

    def fetch():
        info = yf.Ticker(symbol).get_info() or {}
        keys = {
            "name": info.get("longName") or info.get("shortName"),
            "quote_type": info.get("quoteType"),
            "exchange": info.get("fullExchangeName") or info.get("exchange"),
            "currency": info.get("currency"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "country": info.get("country"),
            "market_cap": info.get("marketCap"),
            "trailing_pe": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "dividend_yield_pct": info.get("dividendYield"),
            "beta": info.get("beta"),
            "avg_volume": info.get("averageVolume"),
            "employees": info.get("fullTimeEmployees"),
            "website": info.get("website"),
            "summary": info.get("longBusinessSummary"),
        }
        return keys if any(v is not None for v in keys.values()) else None

    try:
        res = _cached(("profile", symbol), 3600, fetch)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Market data provider error: {e}")
    if not res:
        raise HTTPException(status_code=404, detail=f"No profile for symbol {symbol}")
    return {"symbol": symbol, "source": "yfinance", **res}


@router.get("/search")
def search(q: str = Query(..., min_length=1, max_length=40)):
    """Find tickers by symbol or company name."""
    q = q.strip()

    def fetch():
        res = yf.Search(q, max_results=10, news_count=0)
        return [
            {
                "symbol": r.get("symbol"),
                "name": r.get("longname") or r.get("shortname") or r.get("symbol"),
                "exchange": r.get("exchDisp") or r.get("exchange"),
                "type": r.get("quoteType"),
            }
            for r in (res.quotes or [])
            if r.get("symbol")
        ]

    try:
        return {"results": _cached(("search", q.lower()), 600, fetch)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Search provider error: {e}")
