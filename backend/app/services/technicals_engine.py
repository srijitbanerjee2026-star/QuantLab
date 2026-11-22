"""Pure technical indicators on OHLCV data (no network)."""
from __future__ import annotations

from typing import Any, Optional

import numpy as np
import pandas as pd


def sma(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(n).mean()


def ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False).mean()


def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    """Wilder's RSI (exponential smoothing with alpha = 1/n)."""
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    out = 100 - 100 / (1 + gain / loss.replace(0, np.nan))
    out[(loss == 0) & (gain > 0)] = 100.0
    out[(loss == 0) & (gain == 0)] = 50.0
    return out


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    line = ema(close, fast) - ema(close, slow)
    sig = ema(line, signal)
    return pd.DataFrame({"macd": line, "signal": sig, "hist": line - sig})


def bollinger(close: pd.Series, n: int = 20, k: float = 2.0) -> pd.DataFrame:
    mid = sma(close, n)
    sd = close.rolling(n).std(ddof=0)
    return pd.DataFrame({"mid": mid, "upper": mid + k * sd, "lower": mid - k * sd})


def atr(high: pd.Series, low: pd.Series, close: pd.Series, n: int = 14) -> pd.Series:
    prev = close.shift(1)
    tr = pd.concat([high - low, (high - prev).abs(), (low - prev).abs()], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / n, adjust=False, min_periods=n).mean()


def _series(index: pd.DatetimeIndex, values: pd.Series, nd: int = 4) -> list[Optional[float]]:
    return [None if not np.isfinite(v) else round(float(v), nd) for v in values.reindex(index)]


def _last(s: pd.Series) -> Optional[float]:
    s = s.dropna()
    return float(s.iloc[-1]) if len(s) else None


def compute(df: pd.DataFrame) -> dict[str, Any]:
    """`df`: date-indexed with Open, High, Low, Close, Volume (oldest first)."""
    if len(df) < 30:
        raise ValueError("At least 30 bars are required for technical indicators")
    close, high, low = df["Close"].astype(float), df["High"].astype(float), df["Low"].astype(float)
    vol = df["Volume"].astype(float)

    bb = bollinger(close)
    mc = macd(close)
    r = rsi(close)
    a = atr(high, low, close)
    s20, s50, s200 = sma(close, 20), sma(close, 50), sma(close, 200)

    dates = [str(d)[:10] for d in df.index]
    last_close = float(close.iloc[-1])
    macd_now, sig_now = _last(mc["macd"]), _last(mc["signal"])
    rsi_now = _last(r)
    width = (bb["upper"] - bb["lower"]).iloc[-1]
    pct_b = float((close.iloc[-1] - bb["lower"].iloc[-1]) / width) if np.isfinite(width) and width > 0 else None

    # Last MACD crossover (most recent sign change of the histogram)
    h = mc["hist"].dropna()
    cross = None
    if len(h) > 1:
        sign = np.sign(h.to_numpy())
        idx = np.where(sign[1:] != sign[:-1])[0]
        if len(idx):
            i = int(idx[-1]) + 1
            cross = {"date": str(h.index[i])[:10], "direction": "bullish" if sign[i] > 0 else "bearish", "bars_ago": int(len(h) - 1 - i)}

    s50n, s200n = _last(s50), _last(s200)
    summary = {
        "last_close": round(last_close, 4),
        "trend_vs_sma50": None if s50n is None else ("above" if last_close > s50n else "below"),
        "trend_vs_sma200": None if s200n is None else ("above" if last_close > s200n else "below"),
        "golden_cross_state": None if s50n is None or s200n is None else ("SMA50 above SMA200" if s50n > s200n else "SMA50 below SMA200"),
        "rsi_14": None if rsi_now is None else round(rsi_now, 1),
        "rsi_state": None if rsi_now is None else ("overbought (>70)" if rsi_now > 70 else "oversold (<30)" if rsi_now < 30 else "neutral"),
        "macd_state": None if macd_now is None or sig_now is None else ("MACD above signal" if macd_now > sig_now else "MACD below signal"),
        "last_macd_cross": cross,
        "bollinger_pct_b": None if pct_b is None else round(pct_b, 3),
        "atr_14": None if _last(a) is None else round(_last(a), 4),
        "atr_pct": None if _last(a) is None else round(_last(a) / last_close * 100, 2),
        "volume_vs_20d_avg": None if not np.isfinite(vol.rolling(20).mean().iloc[-1]) or vol.rolling(20).mean().iloc[-1] == 0 else round(float(vol.iloc[-1] / vol.rolling(20).mean().iloc[-1]), 2),
        "high_52w": round(float(close.iloc[-252:].max()), 4),
        "low_52w": round(float(close.iloc[-252:].min()), 4),
    }

    return {
        "dates": dates,
        "candles": [
            {"time": d, "open": round(float(o), 4), "high": round(float(h_), 4), "low": round(float(l), 4), "close": round(float(c), 4), "volume": int(v) if np.isfinite(v) else 0}
            for d, o, h_, l, c, v in zip(dates, df["Open"], high, low, close, vol)
        ],
        "sma20": _series(df.index, s20),
        "sma50": _series(df.index, s50),
        "sma200": _series(df.index, s200),
        "bb_upper": _series(df.index, bb["upper"]),
        "bb_lower": _series(df.index, bb["lower"]),
        "rsi": _series(df.index, r, 2),
        "macd": _series(df.index, mc["macd"], 4),
        "macd_signal": _series(df.index, mc["signal"], 4),
        "macd_hist": _series(df.index, mc["hist"], 4),
        "summary": summary,
    }
