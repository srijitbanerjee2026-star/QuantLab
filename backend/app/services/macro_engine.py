"""Pure macro calculations on real series (no network)."""
from __future__ import annotations

from typing import Any, Optional

import numpy as np
import pandas as pd

SAHM_THRESHOLD = 0.50

# Constant-maturity Treasury yields on FRED, in curve order
CURVE_SERIES = [("3M", "DGS3MO"), ("6M", "DGS6MO"), ("1Y", "DGS1"), ("2Y", "DGS2"), ("5Y", "DGS5"), ("10Y", "DGS10"), ("30Y", "DGS30")]


def sahm_rule(unrate: pd.Series) -> pd.Series:
    """Sahm Rule recession indicator: 3-month average unemployment minus the minimum of that
    3-month average over the previous 12 months. A reading >= 0.50 pts has signalled every US recession since 1970."""
    m3 = unrate.rolling(3).mean()
    prior_min = m3.shift(1).rolling(12).min()
    return (m3 - prior_min).dropna()


def yoy(series: pd.Series, periods: int = 12) -> pd.Series:
    return (series / series.shift(periods) - 1).dropna() * 100


def value_at_or_before(s: pd.Series, when: pd.Timestamp) -> Optional[float]:
    s = s[s.index <= when]
    return float(s.iloc[-1]) if len(s) else None


def curve_snapshot(series: dict[str, pd.Series]) -> dict[str, Any]:
    """`series` maps maturity label -> daily yield series. Compares latest vs 1 month and 1 year earlier."""
    points = []
    as_of = None
    for label, s in series.items():
        s = s.dropna()
        if s.empty:
            continue
        last_date = s.index[-1]
        as_of = last_date if as_of is None or last_date > as_of else as_of
        points.append({
            "maturity": label,
            "yield_pct": round(float(s.iloc[-1]), 2),
            "date": str(last_date)[:10],
            "month_ago_pct": value_at_or_before(s, last_date - pd.DateOffset(months=1)),
            "year_ago_pct": value_at_or_before(s, last_date - pd.DateOffset(years=1)),
        })
    for p in points:
        for k in ("month_ago_pct", "year_ago_pct"):
            p[k] = None if p[k] is None else round(p[k], 2)
    return {"points": points, "as_of": str(as_of)[:10] if as_of is not None else None}


def inversion_state(spread_10y_2y: Optional[float]) -> str:
    if spread_10y_2y is None:
        return "unknown"
    return "inverted" if spread_10y_2y < 0 else "normal"


def to_points(s: pd.Series, nd: int = 3) -> list[dict[str, Any]]:
    return [{"date": str(d)[:10], "value": round(float(v), nd) + 0.0} for d, v in s.items() if np.isfinite(v)]
