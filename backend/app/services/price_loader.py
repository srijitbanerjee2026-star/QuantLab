"""Adjusted-close loader for any ticker (Yahoo Finance), batched and cached."""
from __future__ import annotations

import time
from datetime import date, timedelta
from typing import Optional

import pandas as pd
import yfinance as yf

_CACHE: dict[tuple, tuple[float, pd.DataFrame]] = {}
_TTL = 600


def load_closes(symbols: list[str], years: float = 3.0) -> pd.DataFrame:
    """Date-indexed DataFrame of adjusted closes, one column per symbol.

    Raises ValueError listing symbols that returned no data.
    """
    syms = list(dict.fromkeys(s.strip().upper() for s in symbols if s.strip()))
    if not syms:
        raise ValueError("No symbols provided")
    if len(syms) > 25:
        raise ValueError("At most 25 symbols are supported per request")
    key = (tuple(syms), round(years, 2))
    hit = _CACHE.get(key)
    if hit and time.time() - hit[0] < _TTL:
        return hit[1]

    start = (date.today() - timedelta(days=int(years * 365.25) + 5)).isoformat()
    raw = yf.download(syms, start=start, auto_adjust=True, progress=False, group_by="ticker", threads=True)
    if raw is None or raw.empty:
        raise ValueError(f"No price data returned for: {', '.join(syms)}")

    cols: dict[str, pd.Series] = {}
    for s in syms:
        try:
            frame = raw[s] if len(syms) > 1 else raw
            if len(syms) == 1 and hasattr(frame.columns, "levels"):
                frame = frame[s] if s in frame.columns.get_level_values(0) else frame.droplevel(0, axis=1)
            series = frame["Close"].dropna()
            if len(series):
                cols[s] = series
        except (KeyError, ValueError):
            continue
    missing = [s for s in syms if s not in cols]
    if missing:
        raise ValueError(f"No price data found for: {', '.join(missing)}")

    df = pd.DataFrame(cols)
    df.index = pd.to_datetime(df.index).tz_localize(None)
    _CACHE[key] = (time.time(), df)
    return df


def load_returns(symbols: list[str], years: float = 3.0, how: str = "any") -> pd.DataFrame:
    """Simple daily returns. Rows with any missing asset are dropped (assets trade on different calendars)."""
    closes = load_closes(symbols, years)
    return closes.pct_change().dropna(how="any")


def benchmark_returns(symbol: Optional[str], years: float) -> Optional[pd.Series]:
    if not symbol:
        return None
    try:
        return load_closes([symbol], years)[symbol.upper()].pct_change().dropna()
    except ValueError:
        return None


_OHLCV_CACHE: dict[tuple, tuple[float, pd.DataFrame]] = {}


def load_ohlcv(symbol: str, years: float = 6.0) -> pd.DataFrame:
    """Adjusted `Close` and `Volume` for one ticker, date-indexed (oldest first)."""
    sym = symbol.strip().upper()
    key = (sym, round(years, 2))
    hit = _OHLCV_CACHE.get(key)
    if hit and time.time() - hit[0] < _TTL:
        return hit[1]
    start = (date.today() - timedelta(days=int(years * 365.25) + 5)).isoformat()
    h = yf.Ticker(sym).history(start=start, auto_adjust=True)
    if h is None or h.empty:
        raise ValueError(f"No price data found for: {sym}")
    df = h[["Close", "Volume"]].dropna(subset=["Close"]).copy()
    df.index = pd.to_datetime(df.index).tz_localize(None)
    _OHLCV_CACHE[key] = (time.time(), df)
    return df


_FULL_CACHE: dict[tuple, tuple[float, pd.DataFrame]] = {}


def load_full_ohlcv(symbol: str, years: float = 2.0) -> pd.DataFrame:
    """Split/dividend-adjusted Open, High, Low, Close, Volume for one ticker (oldest first)."""
    sym = symbol.strip().upper()
    key = (sym, round(years, 2))
    hit = _FULL_CACHE.get(key)
    if hit and time.time() - hit[0] < _TTL:
        return hit[1]
    start = (date.today() - timedelta(days=int(years * 365.25) + 5)).isoformat()
    h = yf.Ticker(sym).history(start=start, auto_adjust=True)
    if h is None or h.empty:
        raise ValueError(f"No price data found for: {sym}")
    df = h[["Open", "High", "Low", "Close", "Volume"]].dropna(subset=["Close"]).copy()
    df.index = pd.to_datetime(df.index).tz_localize(None)
    _FULL_CACHE[key] = (time.time(), df)
    return df
