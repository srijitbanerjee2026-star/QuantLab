import numpy as np
import pandas as pd
import pytest

from app.services.ml_engine import FEATURES, build_features, walk_forward


def make_prices(n=1200, phi=0.0, seed=0, sigma=0.01):
    """Close series whose daily returns follow AR(1) with coefficient phi (phi=0 -> random walk)."""
    rng = np.random.default_rng(seed)
    r = np.zeros(n)
    for t in range(1, n):
        r[t] = phi * r[t - 1] + rng.normal(0.0002, sigma)
    close = 100 * np.cumprod(1 + r)
    idx = pd.bdate_range("2019-01-01", periods=n)
    return pd.DataFrame({"Close": close, "Volume": rng.integers(1_000_000, 2_000_000, n)}, index=idx)


def test_features_do_not_use_the_future():
    p = make_prices()
    f1 = build_features(p)
    p2 = p.copy()
    p2.iloc[900:, 0] *= 3.0  # wreck every price from day 900 on
    f2 = build_features(p2)
    cutoff = p.index[899]
    # features up to the last unaffected day are identical
    pd.testing.assert_frame_equal(f1.loc[:cutoff, FEATURES], f2.loc[:cutoff, FEATURES])


def test_label_is_next_day_return():
    p = make_prices(n=300)
    f = build_features(p)
    ret = p["Close"].pct_change()
    assert f["next_ret"].iloc[100] == pytest.approx(ret.iloc[101])
    assert np.isnan(f["next_ret"].iloc[-1])


def test_folds_train_strictly_before_test():
    res = walk_forward(make_prices(), "logistic_regression", min_train=252, step=21)
    assert res["n_folds"] >= 10
    for fold in res["folds"]:
        assert fold["train_end"] < fold["test_start"]


def test_random_walk_has_no_real_edge():
    res = walk_forward(make_prices(phi=0.0, seed=3), "logistic_regression")
    m = res["metrics"]
    assert abs(m["auc"] - 0.5) < 0.08
    assert m["edge_p_value"] > 0.01  # not significantly better than baseline


def test_predictable_series_is_detected():
    # strong momentum: today's return predicts tomorrow's direction
    res = walk_forward(make_prices(n=2500, phi=0.45, seed=5, sigma=0.012), "logistic_regression")
    m = res["metrics"]
    assert m["auc"] > 0.6
    assert m["accuracy_edge"] > 0.03
    assert m["edge_p_value"] < 0.01


def test_outputs_are_consistent():
    res = walk_forward(make_prices(), "random_forest", step=42)
    m = res["metrics"]
    assert len(res["equity_curve"]) == m["oos_observations"]
    assert 0 <= m["accuracy"] <= 1 and 0 <= m["pct_days_long"] <= 1
    assert res["latest"]["signal"] in ("LONG", "FLAT")
    assert sum(res["feature_importance"].values()) == pytest.approx(1.0, abs=1e-2)


def test_costs_never_help():
    p = make_prices(seed=7)
    free = walk_forward(p, "logistic_regression", cost_bps=0)["metrics"]["strategy_return"]
    paid = walk_forward(p, "logistic_regression", cost_bps=25)["metrics"]["strategy_return"]
    assert paid <= free


@pytest.mark.parametrize("kwargs", [
    {"model_type": "nope"},
    {"model_type": "logistic_regression", "step": 1},
])
def test_validation(kwargs):
    with pytest.raises(ValueError):
        walk_forward(make_prices(), **kwargs)


def test_too_little_history():
    with pytest.raises(ValueError):
        walk_forward(make_prices(n=200), "logistic_regression")
