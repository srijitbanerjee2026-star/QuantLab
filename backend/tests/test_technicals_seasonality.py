import numpy as np
import pandas as pd
import pytest

from app.services.seasonality_engine import analyse, monthly_returns
from app.services.technicals_engine import bollinger, compute, macd, rsi, sma


def ohlcv(close, vol=1_000_000):
    c = pd.Series(close, dtype=float)
    idx = pd.bdate_range("2023-01-02", periods=len(c))
    return pd.DataFrame(
        {"Open": c.values, "High": (c * 1.01).values, "Low": (c * 0.99).values, "Close": c.values, "Volume": np.full(len(c), vol)},
        index=idx,
    )


# ---------- technicals ----------
def test_sma_matches_manual():
    s = pd.Series(range(1, 11), dtype=float)
    assert sma(s, 3).iloc[-1] == pytest.approx((8 + 9 + 10) / 3)
    assert np.isnan(sma(s, 3).iloc[1])


def test_rsi_extremes():
    up = pd.Series(np.arange(1, 60, dtype=float))
    down = pd.Series(np.arange(60, 1, -1, dtype=float))
    assert rsi(up).iloc[-1] == pytest.approx(100.0)
    assert rsi(down).iloc[-1] == pytest.approx(0.0, abs=1e-6)
    assert rsi(pd.Series([10.0] * 40)).iloc[-1] == 50.0


def test_rsi_bounded_on_noise():
    r = rsi(pd.Series(100 + np.cumsum(np.random.default_rng(1).normal(0, 1, 500)))).dropna()
    assert ((r >= 0) & (r <= 100)).all()


def test_bollinger_collapses_on_constant_and_widens_with_noise():
    flat = bollinger(pd.Series([50.0] * 40)).iloc[-1]
    assert flat["upper"] == flat["lower"] == 50.0
    noisy = bollinger(pd.Series(50 + np.random.default_rng(2).normal(0, 2, 60))).iloc[-1]
    assert noisy["upper"] > noisy["mid"] > noisy["lower"]


def test_macd_positive_in_uptrend_and_hist_is_line_minus_signal():
    m = macd(pd.Series(np.linspace(100, 200, 120)))
    assert m["macd"].iloc[-1] > 0
    assert (m["hist"] - (m["macd"] - m["signal"])).abs().max() < 1e-12


def test_compute_shapes_and_summary():
    out = compute(ohlcv(np.linspace(100, 160, 260)))
    n = len(out["candles"])
    for k in ("sma20", "sma50", "sma200", "rsi", "macd", "macd_hist", "bb_upper"):
        assert len(out[k]) == n
    assert out["summary"]["trend_vs_sma200"] == "above"
    assert out["summary"]["golden_cross_state"] == "SMA50 above SMA200"
    assert out["sma200"][100] is None  # warm-up is null, not zero


def test_compute_needs_enough_bars():
    with pytest.raises(ValueError):
        compute(ohlcv(np.linspace(100, 110, 20)))


# ---------- seasonality ----------
def monthly_close(n_years=8, january_boost=0.05, seed=0):
    rng = np.random.default_rng(seed)
    idx = pd.bdate_range("2015-01-01", periods=n_years * 252)
    r = rng.normal(0.0003, 0.008, len(idx))
    r[idx.month == 1] += january_boost / 21  # concentrate extra return in January
    return pd.Series(100 * np.cumprod(1 + r), index=idx)


def test_injected_january_effect_is_found():
    res = analyse(monthly_close())
    jan = res["months"][0]
    assert res["best_month"] == "Jan"
    assert jan["avg_return_pct"] > 3
    assert jan["significant_5pct"] is True


def test_no_effect_in_noise_means_few_significant_months():
    res = analyse(monthly_close(january_boost=0.0, seed=4))
    assert res["n_significant"] <= 3  # 12 tests at 5%: a couple of false positives are normal


def test_heatmap_matches_samples():
    res = analyse(monthly_close())
    total = sum(1 for row in res["heatmap"] for v in row["months"] if v is not None)
    assert total == res["n_months"] == sum(m["samples"] for m in res["months"])


def test_incomplete_current_month_is_dropped():
    s = monthly_close()
    cut = s.loc[:"2022-06-10"]  # stops mid-June
    assert monthly_returns(cut).index[-1] < pd.Timestamp("2022-06-01")


def test_seasonality_needs_history():
    with pytest.raises(ValueError):
        analyse(monthly_close(n_years=2))
