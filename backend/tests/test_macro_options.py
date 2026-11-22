import numpy as np
import pandas as pd
import pytest

from app.services.macro_engine import curve_snapshot, inversion_state, sahm_rule, yoy
from app.services.options_engine import analyse_chain, greeks, max_pain


# ---------- macro ----------
def monthly(values, start="2019-01-01"):
    return pd.Series(values, index=pd.date_range(start, periods=len(values), freq="MS"), dtype=float)


def test_sahm_zero_when_unemployment_flat():
    s = sahm_rule(monthly([4.0] * 30))
    assert (s.abs() < 1e-12).all()


def test_sahm_triggers_on_sharp_rise():
    # 4.0% for 18 months, then unemployment jumps 0.3 per month
    u = monthly([4.0] * 18 + [4.3, 4.6, 4.9, 5.2, 5.5])
    s = sahm_rule(u)
    assert s.iloc[-1] >= 0.50
    assert s.iloc[:5].max() < 0.5


def test_sahm_uses_only_prior_year_minimum():
    # declining unemployment never triggers
    s = sahm_rule(monthly(list(np.linspace(6, 3.5, 40))))
    assert s.max() <= 0.0 + 1e-9


def test_yoy_growth():
    s = monthly([100] * 12 + [103])
    assert yoy(s).iloc[-1] == pytest.approx(3.0)


def test_curve_snapshot_picks_latest_and_history():
    idx = pd.bdate_range("2025-01-01", periods=400)
    two = pd.Series(np.linspace(4.0, 4.8, 400), index=idx)
    ten = pd.Series(np.linspace(4.5, 4.5, 400), index=idx)
    snap = curve_snapshot({"2Y": two, "10Y": ten})
    p = {x["maturity"]: x for x in snap["points"]}
    assert p["2Y"]["yield_pct"] == pytest.approx(4.8, abs=0.01)
    assert p["2Y"]["year_ago_pct"] is not None and p["2Y"]["year_ago_pct"] < p["2Y"]["yield_pct"]
    assert inversion_state(round(p["10Y"]["yield_pct"] - p["2Y"]["yield_pct"], 2)) == "inverted"
    assert inversion_state(0.3) == "normal" and inversion_state(None) == "unknown"


# ---------- options ----------
def test_greeks_identities():
    g = greeks(100.0, [80, 100, 120], 0.25, 0.04, [0.3, 0.3, 0.3])
    assert np.allclose(g["call_delta"] - g["put_delta"], 1.0)  # q = 0
    assert (g["gamma"] > 0).all()
    assert g["gamma"][1] > g["gamma"][0] and g["gamma"][1] > g["gamma"][2]  # peaks near the money
    assert 0.5 < g["call_delta"][1] < 0.65


def test_gamma_is_derivative_of_delta():
    S, h = 100.0, 0.01
    up = greeks(S + h, [100], 0.25, 0.04, [0.3])["call_delta"][0]
    dn = greeks(S - h, [100], 0.25, 0.04, [0.3])["call_delta"][0]
    assert (up - dn) / (2 * h) == pytest.approx(greeks(S, [100], 0.25, 0.04, [0.3])["gamma"][0], rel=1e-4)


def chain(strikes, c_oi, p_oi, iv=0.3):
    base = lambda oi: pd.DataFrame({
        "strike": strikes, "openInterest": oi, "volume": 10, "impliedVolatility": iv, "bid": 1.0, "ask": 1.1, "lastPrice": 1.0,
    })
    return base(c_oi), base(p_oi)


def test_max_pain_known_case():
    # All open interest at 100: holders are paid nothing if the stock expires at 100
    calls, puts = chain([90, 100, 110], [0, 1000, 0], [0, 1000, 0])
    assert max_pain(calls, puts) == 100.0


def test_analyse_chain_outputs():
    ks = list(range(80, 125, 5))
    calls, puts = chain(ks, [100 + 50 * (k == 110) for k in ks], [100 + 80 * (k == 90) for k in ks])
    res = analyse_chain(calls, puts, spot=100.0, T=30 / 365, r=0.04)
    assert res["call_wall"] == 110 and res["put_wall"] == 90
    assert res["expected_move_1sd"] == pytest.approx(100 * 0.3 * np.sqrt(30 / 365), rel=0.01)
    assert res["put_call_oi_ratio"] > 0
    assert len(res["strikes"]) == len(ks)


def test_junk_iv_is_not_used_for_greeks():
    ks = [95, 100, 105]
    calls, puts = chain(ks, 100, 100, iv=1e-5)  # Yahoo's placeholder IV on dead quotes
    res = analyse_chain(calls, puts, spot=100.0, T=0.1, r=0.04)
    assert res["atm_iv"] is None
    assert res["net_gex"] == 0  # no usable IV -> no fabricated exposure


def test_invalid_inputs():
    calls, puts = chain([100], 10, 10)
    with pytest.raises(ValueError):
        analyse_chain(calls, puts, spot=100.0, T=0, r=0.04)
    with pytest.raises(ValueError):
        analyse_chain(calls, puts, spot=1000.0, T=0.1, r=0.04)  # no strikes near spot
