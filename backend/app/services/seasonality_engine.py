"""Pure calendar-month return statistics (no network)."""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def monthly_returns(close: pd.Series) -> pd.Series:
    """Calendar-month returns from month-end closes. The first (partial) month is dropped, and so is the current month
    if it is still in progress (last bar is not the last trading day of the month)."""
    close = close.dropna()
    m = close.resample("ME").last()
    ret = m.pct_change().dropna()
    last_bar = close.index[-1]
    if ret.index[-1].to_period("M") == last_bar.to_period("M") and last_bar < ret.index[-1] - pd.Timedelta(days=4):
        ret = ret.iloc[:-1]
    return ret


def analyse(close: pd.Series) -> dict[str, Any]:
    ret = monthly_returns(close)
    if len(ret) < 36:
        raise ValueError("At least 3 years of monthly history is required for seasonality statistics")

    rows = []
    for m in range(1, 13):
        r = ret[ret.index.month == m] * 100
        n = len(r)
        mean = float(r.mean())
        sd = float(r.std(ddof=1)) if n > 1 else float("nan")
        t = mean / (sd / np.sqrt(n)) if n > 1 and sd > 0 else None
        rows.append({
            "month": MONTHS[m - 1],
            "month_num": m,
            "samples": int(n),
            "avg_return_pct": round(mean, 2),
            "median_return_pct": round(float(r.median()), 2),
            "std_pct": round(sd, 2) if np.isfinite(sd) else None,
            "win_rate_pct": round(float((r > 0).mean() * 100), 1),
            "best_pct": round(float(r.max()), 2),
            "worst_pct": round(float(r.min()), 2),
            "t_stat": round(float(t), 2) if t is not None else None,
            "significant_5pct": bool(t is not None and abs(t) > 2.0),
        })

    years = sorted(set(ret.index.year))
    heat = []
    for y in years:
        by_m = {d.month: float(v) * 100 for d, v in ret[ret.index.year == y].items()}
        heat.append({"year": int(y), "months": [round(by_m[m], 2) if m in by_m else None for m in range(1, 13)]})

    best = max(rows, key=lambda r: r["avg_return_pct"])
    worst = min(rows, key=lambda r: r["avg_return_pct"])
    return {
        "months": rows,
        "heatmap": heat,
        "best_month": best["month"],
        "worst_month": worst["month"],
        "n_months": int(len(ret)),
        "first_month": str(ret.index[0])[:7],
        "last_month": str(ret.index[-1])[:7],
        "overall_win_rate_pct": round(float((ret > 0).mean() * 100), 1),
        "n_significant": int(sum(r["significant_5pct"] for r in rows)),
    }
