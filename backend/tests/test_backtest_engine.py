import numpy as np
import pandas as pd
import pytest

from app.services.backtest_engine import simulate


def make_df(prices, rsi=None):
    s = pd.Series(prices, dtype=float)
    return pd.DataFrame({
        "date": pd.bdate_range("2024-01-01", periods=len(s)),
        "adj_close": s,
        "simple_return": s.pct_change(),
        "rsi_14": rsi if rsi is not None else np.nan,
    })


def trending(n=200):
    # up for n bars, then down: SMA crossover should be long during the uptrend
    return np.concatenate([np.linspace(100, 200, n), np.linspace(200, 120, n)])


def test_no_lookahead_and_basic_metrics():
    sim, trades, m = simulate(make_df(trending()), "sma_crossover", 10000, 10, 30)
    # position is the signal shifted one bar
    assert sim["position"].iloc[1:].tolist() == sim["signal"].iloc[:-1].astype(float).tolist()
    assert m["max_drawdown_pct"] <= 0
    assert m["trading_days"] == len(sim)
    assert len(trades) >= 1


def test_costs_reduce_return():
    df = make_df(trending())
    _, _, free = simulate(df, "sma_crossover", 10000, 10, 30, cost_bps=0)
    _, _, paid = simulate(df, "sma_crossover", 10000, 10, 30, cost_bps=50)
    assert paid["total_return_pct"] < free["total_return_pct"]


def test_date_range_slices_after_warmup():
    df = make_df(trending())
    full, _, _ = simulate(df, "sma_crossover", 10000, 10, 30)
    sub, _, _ = simulate(df, "sma_crossover", 10000, 10, 30, start="2024-06-03")
    assert sub["date"].min() >= pd.Timestamp("2024-06-03")
    assert len(sub) < len(full)


def test_flat_prices_zero_return():
    _, trades, m = simulate(make_df([100.0] * 120), "sma_crossover", 10000, 5, 20)
    assert m["total_return_pct"] == 0
    assert trades == []


def test_rsi_state_is_held():
    rsi = [50] * 10 + [20] + [50] * 10 + [80] + [50] * 10
    df = make_df(np.linspace(100, 110, len(rsi)), rsi=pd.Series(rsi, dtype=float))
    sim, trades, _ = simulate(df, "rsi_mean_reversion", 10000)
    assert sim["signal"].iloc[10:21].eq(1).all()  # held from oversold until overbought
    assert sim["signal"].iloc[21:].eq(0).all()
    assert len(trades) == 1 and not trades[0]["open"]


@pytest.mark.parametrize("kwargs", [
    {"initial_capital": 0},
    {"cost_bps": -1},
    {"short_w": 50, "long_w": 20},
    {"strategy_type": "nope"},
])
def test_validation_errors(kwargs):
    with pytest.raises(ValueError):
        simulate(make_df(trending()), **{"strategy_type": "sma_crossover", **kwargs})
