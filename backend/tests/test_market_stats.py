import numpy as np
import pandas as pd
import pytest

from app.services.market_stats import compute_performance


def series(values, end="2026-11-20"):
    idx = pd.bdate_range(end=end, periods=len(values))
    return pd.Series(values, index=idx, dtype=float)


def test_trailing_returns_and_range():
    s = series(np.linspace(100, 200, 300))
    p = compute_performance(s)
    assert p["last"] == 200
    assert p["returns_pct"]["1D"] == pytest.approx((200 / s.iloc[-2] - 1) * 100, abs=0.01)
    assert p["returns_pct"]["1Y"] == pytest.approx((200 / s.iloc[-253] - 1) * 100, abs=0.01)
    assert p["high_52w"] == 200
    assert p["pct_from_high_52w"] == 0
    assert p["max_drawdown_1y_pct"] == 0  # monotonic rise


def test_short_history_gives_none_not_error():
    p = compute_performance(series([100, 101, 102, 103, 104, 105, 106]))
    assert p["returns_pct"]["1M"] is None
    assert p["returns_pct"]["1D"] is not None


def test_drawdown_detected():
    s = series([100] * 100 + [120] * 50 + [90] * 100)
    p = compute_performance(s)
    assert p["max_drawdown_1y_pct"] == pytest.approx(-25.0, abs=0.01)


def test_ytd_uses_prior_year_close():
    idx = pd.to_datetime(["2025-12-30", "2025-12-31", "2026-01-02", "2026-01-05"])
    p = compute_performance(pd.Series([100.0, 110.0, 121.0, 132.0], index=idx))
    assert p["returns_pct"]["YTD"] == pytest.approx(20.0, abs=0.01)


def test_too_little_data():
    with pytest.raises(ValueError):
        compute_performance(series([100]))
