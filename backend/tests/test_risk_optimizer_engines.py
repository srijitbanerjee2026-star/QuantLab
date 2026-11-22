import numpy as np
import pandas as pd
import pytest

from app.services.risk_engine import (
    correlation_matrix,
    cvar,
    drawdown_series,
    historical_var,
    risk_report,
)
from app.services.optimizer_engine import optimise


def make_returns(n=500, mu=0.0005, sigma=0.01, seed=1):
    rng = np.random.default_rng(seed)
    idx = pd.bdate_range("2023-01-02", periods=n)
    return pd.Series(rng.normal(mu, sigma, n), index=idx)


# ---------- risk ----------
def test_var_ordering_and_cvar_worse_than_var():
    r = make_returns()
    v90, v95, v99 = (historical_var(r, c) for c in (0.90, 0.95, 0.99))
    assert v99 < v95 < v90 < 0
    assert cvar(r, 0.95) <= v95


def test_drawdown_known_path():
    r = pd.Series([0.1, -0.2, 0.05], index=pd.bdate_range("2024-01-01", periods=3))
    dd = drawdown_series(r)
    assert dd.iloc[0] == 0
    assert dd.iloc[1] == pytest.approx(-0.2)
    # wealth: 1.1 -> 0.88 -> 0.924 ; peak stays 1.1
    assert dd.iloc[2] == pytest.approx(0.924 / 1.1 - 1)


def test_beta_of_scaled_benchmark_is_scale():
    bench = make_returns(seed=2)
    asset = bench * 1.5  # exactly 1.5x leveraged
    rep = risk_report(asset, benchmark=bench)
    assert rep["benchmark"]["beta"] == pytest.approx(1.5, abs=1e-3)
    assert rep["benchmark"]["correlation"] == pytest.approx(1.0, abs=1e-6)


def test_report_fields_sane():
    rep = risk_report(make_returns())
    assert rep["max_drawdown"] <= 0
    assert rep["annualized_volatility"] == pytest.approx(0.01 * np.sqrt(252), rel=0.15)
    assert len(rep["drawdown_curve"]) == rep["observations"]
    assert sum(b["count"] for b in rep["histogram"]) == rep["observations"]


def test_report_needs_enough_data():
    with pytest.raises(ValueError):
        risk_report(make_returns(n=10))


def test_correlation_matrix_diagonal_is_one():
    a = make_returns(seed=3)
    df = pd.DataFrame({"A": a, "B": make_returns(seed=4), "C": a * -1})
    c = correlation_matrix(df)
    m = np.array(c["matrix"])
    assert np.allclose(np.diag(m), 1.0)
    assert m[0, 2] == pytest.approx(-1.0, abs=1e-6)


# ---------- optimiser ----------
def basket(n_assets=4, n=600):
    idx = pd.bdate_range("2022-01-03", periods=n)
    cols = {}
    for i in range(n_assets):
        rng = np.random.default_rng(10 + i)
        cols[f"S{i}"] = rng.normal(0.0002 + 0.0002 * i, 0.008 + 0.004 * i, n)
    return pd.DataFrame(cols, index=idx)


def test_weights_sum_to_one_long_only_and_beat_equal_weight():
    res = optimise(basket())
    for key in ("equal_weight", "max_sharpe", "min_volatility"):
        w = np.array(list(res[key]["weights"].values()))
        assert w.sum() == pytest.approx(1.0, abs=1e-3)
        assert (w >= -1e-9).all()
    assert res["max_sharpe"]["sharpe_ratio"] >= res["equal_weight"]["sharpe_ratio"] - 1e-6
    assert res["min_volatility"]["volatility"] <= res["equal_weight"]["volatility"] + 1e-6


def test_max_weight_cap_is_respected():
    res = optimise(basket(), max_weight=0.4)
    assert max(res["max_sharpe"]["weights"].values()) <= 0.4 + 1e-4
    assert max(res["min_volatility"]["weights"].values()) <= 0.4 + 1e-4


def test_infeasible_cap_rejected():
    with pytest.raises(ValueError):
        optimise(basket(n_assets=3), max_weight=0.2)


def test_frontier_is_sorted_and_risk_contributions_sum_to_one():
    res = optimise(basket())
    vols = [p["volatility"] for p in res["frontier"]]
    assert len(vols) >= 10
    assert vols[0] <= res["min_volatility"]["volatility"] + 1e-3
    rc = sum(res["max_sharpe"]["risk_contribution"].values())
    assert rc == pytest.approx(1.0, abs=1e-3)


def test_too_few_assets_or_data():
    with pytest.raises(ValueError):
        optimise(basket(n_assets=1))
    with pytest.raises(ValueError):
        optimise(basket(n=30))
