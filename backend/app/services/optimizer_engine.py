"""Pure mean-variance optimisation (long-only, SLSQP). No database or network."""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from scipy.optimize import minimize

TRADING_DAYS = 252


def _perf(w: np.ndarray, mu: np.ndarray, cov: np.ndarray, rf: float) -> tuple[float, float, float]:
    ret = float(w @ mu)
    vol = float(np.sqrt(max(w @ cov @ w, 0.0)))
    return ret, vol, (ret - rf) / vol if vol > 0 else 0.0


def _solve(objective, n: int, max_w: float, extra: list | None = None) -> np.ndarray:
    cons = [{"type": "eq", "fun": lambda w: np.sum(w) - 1}] + (extra or [])
    best = None
    starts = [np.full(n, 1 / n)] + [np.random.default_rng(i).dirichlet(np.ones(n)) for i in range(3)]
    for x0 in starts:
        x0 = np.minimum(x0, max_w)
        x0 = x0 / x0.sum()
        res = minimize(objective, x0, method="SLSQP", bounds=[(0.0, max_w)] * n, constraints=cons,
                       options={"maxiter": 500, "ftol": 1e-10})
        if res.success and (best is None or res.fun < best.fun):
            best = res
    if best is None:
        raise ValueError("Optimiser did not converge; try relaxing the weight cap")
    w = np.clip(best.x, 0, None)
    return w / w.sum()


def _pack(w: np.ndarray, symbols: list[str], mu, cov, rf) -> dict[str, Any]:
    ret, vol, sh = _perf(w, mu, cov, rf)
    # Risk contribution: share of total portfolio variance from each asset
    mrc = cov @ w
    contrib = w * mrc / (w @ cov @ w) if vol > 0 else np.zeros_like(w)
    return {
        "weights": {s: round(float(x), 4) for s, x in zip(symbols, w)},
        "expected_return": round(ret, 4),
        "volatility": round(vol, 4),
        "sharpe_ratio": round(sh, 4),
        "risk_contribution": {s: round(float(x), 4) for s, x in zip(symbols, contrib)},
    }


def optimise(returns_df: pd.DataFrame, risk_free_rate: float = 0.02, max_weight: float = 1.0, frontier_points: int = 25) -> dict[str, Any]:
    """`returns_df`: simple daily returns, one column per asset."""
    returns_df = returns_df.dropna()
    symbols = list(returns_df.columns)
    n = len(symbols)
    if n < 2:
        raise ValueError("Portfolio optimisation requires at least 2 assets")
    if len(returns_df) < 60:
        raise ValueError("At least 60 overlapping daily observations are required")
    if not 0 < max_weight <= 1:
        raise ValueError("max_weight must be in (0, 1]")
    if max_weight * n < 1 - 1e-9:
        raise ValueError(f"max_weight {max_weight:.0%} is infeasible with {n} assets (need at least {1 / n:.0%})")

    mu = returns_df.mean().to_numpy() * TRADING_DAYS
    cov = returns_df.cov().to_numpy() * TRADING_DAYS
    rf = risk_free_rate

    equal = np.full(n, 1 / n)
    max_sharpe = _solve(lambda w: -_perf(w, mu, cov, rf)[2], n, max_weight)
    min_vol = _solve(lambda w: _perf(w, mu, cov, rf)[1], n, max_weight)

    # Efficient frontier: minimum volatility for target returns between min-vol return and best single-asset cap
    lo = _perf(min_vol, mu, cov, rf)[0]
    hi = float(max(_perf(max_sharpe, mu, cov, rf)[0], mu.max() if max_weight >= 1 else lo))
    frontier = []
    for target in np.linspace(lo, hi, frontier_points):
        try:
            w = _solve(lambda x: _perf(x, mu, cov, rf)[1], n, max_weight,
                       [{"type": "eq", "fun": lambda x, t=target: float(x @ mu) - t}])
        except ValueError:
            continue
        r, v, s = _perf(w, mu, cov, rf)
        frontier.append({"return": round(r, 4), "volatility": round(v, 4), "sharpe": round(s, 4)})

    assets = [
        {"symbol": s, "expected_return": round(float(mu[i]), 4), "volatility": round(float(np.sqrt(cov[i, i])), 4)}
        for i, s in enumerate(symbols)
    ]
    corr = returns_df.corr().to_numpy()
    return {
        "symbols": symbols,
        "observations": int(len(returns_df)),
        "start": str(returns_df.index[0])[:10],
        "end": str(returns_df.index[-1])[:10],
        "risk_free_rate": rf,
        "max_weight": max_weight,
        "equal_weight": _pack(equal, symbols, mu, cov, rf),
        "max_sharpe": _pack(max_sharpe, symbols, mu, cov, rf),
        "min_volatility": _pack(min_vol, symbols, mu, cov, rf),
        "frontier": frontier,
        "assets": assets,
        "correlation": {"symbols": symbols, "matrix": [[round(float(v), 3) for v in row] for row in corr]},
    }
