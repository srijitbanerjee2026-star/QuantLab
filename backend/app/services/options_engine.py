"""Pure options-chain analytics (Black-Scholes-Merton greeks; no network).

Gamma/delta exposure uses a common but ASSUMED dealer-positioning convention (dealers long calls / short puts).
Real dealer positioning is not observable from the public chain, so treat GEX as an estimate under that assumption.
"""
from __future__ import annotations

from typing import Any, Optional

import numpy as np
import pandas as pd
from scipy.stats import norm

CONTRACT_SIZE = 100


def bs_d1(S: float, K: np.ndarray, T: float, r: float, q: float, sigma: np.ndarray) -> np.ndarray:
    return (np.log(S / K) + (r - q + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))


def greeks(S: float, K, T: float, r: float, sigma, q: float = 0.0) -> dict[str, np.ndarray]:
    K = np.asarray(K, dtype=float)
    sigma = np.asarray(sigma, dtype=float)
    d1 = bs_d1(S, K, T, r, q, sigma)
    disc_q = np.exp(-q * T)
    call_delta = disc_q * norm.cdf(d1)
    put_delta = call_delta - disc_q
    gamma = disc_q * norm.pdf(d1) / (S * sigma * np.sqrt(T))
    vega = S * disc_q * norm.pdf(d1) * np.sqrt(T) / 100.0  # per 1 vol point
    return {"call_delta": call_delta, "put_delta": put_delta, "gamma": gamma, "vega": vega}


def _clean(df: pd.DataFrame, spot: float, lo: float, hi: float) -> pd.DataFrame:
    d = df.copy()
    for c in ("openInterest", "volume", "impliedVolatility", "bid", "ask", "lastPrice"):
        if c not in d:
            d[c] = np.nan
    d["openInterest"] = pd.to_numeric(d["openInterest"], errors="coerce").fillna(0)
    d["volume"] = pd.to_numeric(d["volume"], errors="coerce").fillna(0)
    d["impliedVolatility"] = pd.to_numeric(d["impliedVolatility"], errors="coerce")
    # Yahoo reports tiny IVs (e.g. 1e-5) for illiquid/zero-bid contracts: those are not real quotes.
    d.loc[(d["impliedVolatility"] < 0.02) | (d["impliedVolatility"] > 5.0), "impliedVolatility"] = np.nan
    return d[(d["strike"] >= spot * lo) & (d["strike"] <= spot * hi)].sort_values("strike")


def max_pain(calls: pd.DataFrame, puts: pd.DataFrame) -> Optional[float]:
    """Strike at which total intrinsic value paid to option holders at expiry is smallest."""
    strikes = np.array(sorted(set(calls["strike"]) | set(puts["strike"])), dtype=float)
    if len(strikes) == 0:
        return None
    c_k, c_oi = calls["strike"].to_numpy(float), calls["openInterest"].to_numpy(float)
    p_k, p_oi = puts["strike"].to_numpy(float), puts["openInterest"].to_numpy(float)
    pain = [(np.maximum(s - c_k, 0) * c_oi).sum() + (np.maximum(p_k - s, 0) * p_oi).sum() for s in strikes]
    return float(strikes[int(np.argmin(pain))])


def analyse_chain(
    calls: pd.DataFrame, puts: pd.DataFrame, spot: float, T: float, r: float, q: float = 0.0,
    moneyness_lo: float = 0.7, moneyness_hi: float = 1.3,
) -> dict[str, Any]:
    if T <= 0 or spot <= 0:
        raise ValueError("Invalid spot or time to expiry")
    c = _clean(calls, spot, moneyness_lo, moneyness_hi)
    p = _clean(puts, spot, moneyness_lo, moneyness_hi)
    if c.empty or p.empty:
        raise ValueError("Option chain has no usable strikes near the current price")

    strikes = sorted(set(c["strike"]) | set(p["strike"]))
    c_idx, p_idx = c.set_index("strike"), p.set_index("strike")
    rows = []
    for k in strikes:
        cr = c_idx.loc[k] if k in c_idx.index else None
        pr = p_idx.loc[k] if k in p_idx.index else None
        c_oi = float(cr["openInterest"]) if cr is not None else 0.0
        p_oi = float(pr["openInterest"]) if pr is not None else 0.0
        c_iv = float(cr["impliedVolatility"]) if cr is not None and np.isfinite(cr["impliedVolatility"]) else None
        p_iv = float(pr["impliedVolatility"]) if pr is not None and np.isfinite(pr["impliedVolatility"]) else None
        # Each side's greeks use that contract's own IV. If one side has no usable IV, reuse the other side's
        # (put-call parity makes them equal for European options); if neither has one, greeks are not computed.
        gc_iv = c_iv if c_iv is not None else p_iv
        gp_iv = p_iv if p_iv is not None else c_iv
        gamma_c = gamma_p = None
        d_c = d_p = None
        if gc_iv:
            g = greeks(spot, [k], T, r, [gc_iv], q)
            gamma_c, d_c = float(g["gamma"][0]), float(g["call_delta"][0])
        if gp_iv:
            g = greeks(spot, [k], T, r, [gp_iv], q)
            gamma_p, d_p = float(g["gamma"][0]), float(g["put_delta"][0])
        unit = CONTRACT_SIZE * spot * spot * 0.01  # $ change in dealer delta per 1% move
        gex = (gamma_c or 0.0) * c_oi * unit - (gamma_p or 0.0) * p_oi * unit
        dex = (d_c or 0.0) * c_oi * CONTRACT_SIZE * spot + (d_p or 0.0) * p_oi * CONTRACT_SIZE * spot
        rows.append({
            "strike": float(k),
            "call_oi": int(c_oi), "put_oi": int(p_oi),
            "call_volume": int(cr["volume"]) if cr is not None else 0,
            "put_volume": int(pr["volume"]) if pr is not None else 0,
            "call_iv": None if c_iv is None else round(c_iv, 4),
            "put_iv": None if p_iv is None else round(p_iv, 4),
            "gex": round(float(gex), 0),
            "dex": round(float(dex), 0),
        })

    # ATM implied vol and 1-sigma expected move
    near = min(strikes, key=lambda k: abs(k - spot))
    atm_ivs = [x for x in (rows[strikes.index(near)]["call_iv"], rows[strikes.index(near)]["put_iv"]) if x]
    atm_iv = float(np.mean(atm_ivs)) if atm_ivs else None
    expected_move = spot * atm_iv * np.sqrt(T) if atm_iv else None

    # Gamma flip: where cumulative net GEX (from low strikes) crosses zero
    cum = np.cumsum([r_["gex"] for r_ in rows])
    flip = None
    for i in range(1, len(cum)):
        if cum[i - 1] < 0 <= cum[i] or cum[i - 1] > 0 >= cum[i]:
            a, b = rows[i - 1]["strike"], rows[i]["strike"]
            w = abs(cum[i - 1]) / (abs(cum[i - 1]) + abs(cum[i]) or 1)
            flip = round(a + (b - a) * w, 2)
            break

    tot_c_oi, tot_p_oi = sum(r_["call_oi"] for r_ in rows), sum(r_["put_oi"] for r_ in rows)
    tot_c_v, tot_p_v = sum(r_["call_volume"] for r_ in rows), sum(r_["put_volume"] for r_ in rows)
    call_wall = max(rows, key=lambda r_: r_["call_oi"])["strike"] if tot_c_oi else None
    put_wall = max(rows, key=lambda r_: r_["put_oi"])["strike"] if tot_p_oi else None

    # Skew: IV 10% below spot vs 10% above (puts vs calls), interpolated from the strikes available
    def iv_at(frac: float, side: str) -> Optional[float]:
        pts = [(r_["strike"], r_[f"{side}_iv"]) for r_ in rows if r_[f"{side}_iv"]]
        if len(pts) < 2:
            return None
        ks, vs = zip(*pts)
        target = spot * frac
        return float(np.interp(target, ks, vs)) if ks[0] <= target <= ks[-1] else None

    p90, c110 = iv_at(0.90, "put"), iv_at(1.10, "call")
    return {
        "spot": round(spot, 4),
        "days_to_expiry": round(T * 365),
        "atm_iv": None if atm_iv is None else round(atm_iv, 4),
        "expected_move_1sd": None if expected_move is None else round(float(expected_move), 2),
        "expected_move_pct": None if expected_move is None else round(float(expected_move / spot * 100), 2),
        "put_call_oi_ratio": round(tot_p_oi / tot_c_oi, 3) if tot_c_oi else None,
        "put_call_volume_ratio": round(tot_p_v / tot_c_v, 3) if tot_c_v else None,
        "total_call_oi": int(tot_c_oi), "total_put_oi": int(tot_p_oi),
        "net_gex": round(float(sum(r_["gex"] for r_ in rows)), 0),
        "net_dex": round(float(sum(r_["dex"] for r_ in rows)), 0),
        "gamma_flip": flip,
        "call_wall": call_wall, "put_wall": put_wall,
        "max_pain": max_pain(c, p),
        "skew_put90_minus_call110": None if p90 is None or c110 is None else round(p90 - c110, 4),
        "strikes": rows,
    }
