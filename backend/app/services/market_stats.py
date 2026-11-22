"""Pure statistics for the Market Explorer (no network): trailing returns, 52-week range, risk."""
from __future__ import annotations

from typing import Any, Optional

import numpy as np
import pandas as pd

# Trailing windows in trading days
WINDOWS = {"1D": 1, "1W": 5, "1M": 21, "3M": 63, "6M": 126, "1Y": 252, "3Y": 756}


def _pct(a: float, b: float) -> Optional[float]:
    if b is None or b == 0 or not np.isfinite(a) or not np.isfinite(b):
        return None
    return round((a / b - 1) * 100, 2)


def compute_performance(close: pd.Series) -> dict[str, Any]:
    """`close` is a date-indexed series of adjusted closes, oldest first."""
    close = close.dropna()
    if len(close) < 2:
        raise ValueError("Not enough price history")
    last = float(close.iloc[-1])

    returns: dict[str, Optional[float]] = {}
    for label, n in WINDOWS.items():
        returns[label] = _pct(last, float(close.iloc[-1 - n])) if len(close) > n else None

    idx = pd.DatetimeIndex(close.index)
    this_year = close[idx.year == idx[-1].year]
    prev = close[idx.year < idx[-1].year]
    base = float(prev.iloc[-1]) if len(prev) else float(this_year.iloc[0])
    returns["YTD"] = _pct(last, base)

    year = close.iloc[-252:]
    daily = year.pct_change().dropna()
    dd = year / year.cummax() - 1
    return {
        "last": round(last, 4),
        "returns_pct": returns,
        "high_52w": round(float(year.max()), 4),
        "low_52w": round(float(year.min()), 4),
        "pct_from_high_52w": _pct(last, float(year.max())),
        "volatility_1y_pct": round(float(daily.std(ddof=1) * np.sqrt(252) * 100), 2) if len(daily) > 2 else None,
        "max_drawdown_1y_pct": round(float(dd.min() * 100), 2),
        "observations": int(len(close)),
    }
