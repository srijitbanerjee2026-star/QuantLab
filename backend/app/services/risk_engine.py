"""Pure risk analytics on a return series (no database or network)."""
from __future__ import annotations

from typing import Any, Optional

import numpy as np
import pandas as pd
from scipy.stats import norm

TRADING_DAYS = 252


def _r(x: float, d: int = 4) -> Optional[float]:
    return round(float(x), d) if x is not None and np.isfinite(x) else None


def historical_var(returns: pd.Series, confidence: float) -> float:
    """Loss threshold (as a negative return) not exceeded with `confidence` probability."""
    return float(np.quantile(returns, 1 - confidence))


def parametric_var(returns: pd.Series, confidence: float) -> float:
    return float(norm.ppf(1 - confidence, returns.mean(), returns.std(ddof=1)))


def cvar(returns: pd.Series, confidence: float) -> float:
    """Expected shortfall: mean return in the tail beyond the historical VaR."""
    var = historical_var(returns, confidence)
    tail = returns[returns <= var]
    return float(tail.mean()) if len(tail) else var


def drawdown_series(returns: pd.Series) -> pd.Series:
    wealth = (1 + returns).cumprod()
    return wealth / wealth.cummax() - 1


def histogram(returns: pd.Series, bins: int = 31) -> list[dict[str, float]]:
    counts, edges = np.histogram(returns, bins=bins)
    return [
        {"lo": _r(edges[i], 5), "hi": _r(edges[i + 1], 5), "mid": _r((edges[i] + edges[i + 1]) / 2, 5), "count": int(c)}
        for i, c in enumerate(counts)
    ]


def risk_report(
    returns: pd.Series,
    benchmark: Optional[pd.Series] = None,
    risk_free_rate: float = 0.02,
    rolling_window: int = 60,
) -> dict[str, Any]:
    """`returns` are simple daily returns indexed by date. `benchmark` is aligned on the index."""
    returns = returns.dropna()
    if len(returns) < 30:
        raise ValueError("At least 30 daily returns are required for a meaningful risk report")

    n = len(returns)
    years = n / TRADING_DAYS
    growth = float((1 + returns).prod())
    ann_ret = growth ** (1 / years) - 1 if growth > 0 else -1.0
    std = float(returns.std(ddof=1))
    ann_vol = std * np.sqrt(TRADING_DAYS)

    rf_daily = risk_free_rate / TRADING_DAYS
    excess = returns - rf_daily
    sharpe = float(excess.mean() / std * np.sqrt(TRADING_DAYS)) if std > 0 else None
    # Downside deviation relative to the risk-free rate (target semi-deviation)
    downside = np.minimum(excess, 0.0)
    dd_dev = float(np.sqrt((downside**2).mean()))
    sortino = float(excess.mean() / dd_dev * np.sqrt(TRADING_DAYS)) if dd_dev > 0 else None

    dd = drawdown_series(returns)
    max_dd = float(dd.min())
    trough = dd.idxmin()
    peak = (1 + returns).cumprod().loc[:trough].idxmax()

    out: dict[str, Any] = {
        "observations": n,
        "start": str(returns.index[0])[:10],
        "end": str(returns.index[-1])[:10],
        "annualized_return": _r(ann_ret),
        "annualized_volatility": _r(ann_vol),
        "sharpe_ratio": _r(sharpe) if sharpe is not None else None,
        "sortino_ratio": _r(sortino) if sortino is not None else None,
        "max_drawdown": _r(max_dd),
        "max_drawdown_peak": str(peak)[:10],
        "max_drawdown_trough": str(trough)[:10],
        "calmar_ratio": _r(ann_ret / abs(max_dd)) if max_dd < 0 else None,
        "skewness": _r(returns.skew()),
        "excess_kurtosis": _r(returns.kurt()),
        "best_day": _r(returns.max()),
        "worst_day": _r(returns.min()),
        "var": {
            f"{int(c * 100)}": {
                "historical": _r(historical_var(returns, c)),
                "parametric": _r(parametric_var(returns, c)),
            }
            for c in (0.90, 0.95, 0.99)
        },
        "cvar_95": _r(cvar(returns, 0.95)),
        "drawdown_curve": [{"date": str(i)[:10], "value": _r(v, 5)} for i, v in dd.items()],
        "rolling_volatility": [
            {"date": str(i)[:10], "value": _r(v, 5)}
            for i, v in (returns.rolling(rolling_window).std(ddof=1) * np.sqrt(TRADING_DAYS)).dropna().items()
        ],
        "histogram": histogram(returns),
        "benchmark": None,
    }

    if benchmark is not None:
        joined = pd.concat([returns.rename("a"), benchmark.rename("b")], axis=1).dropna()
        if len(joined) >= 30 and joined["b"].var(ddof=1) > 0:
            cov = float(joined["a"].cov(joined["b"]))
            beta = cov / float(joined["b"].var(ddof=1))
            # Annualised Jensen's alpha against the benchmark
            alpha = (joined["a"].mean() - rf_daily - beta * (joined["b"].mean() - rf_daily)) * TRADING_DAYS
            te = float((joined["a"] - joined["b"]).std(ddof=1) * np.sqrt(TRADING_DAYS))
            out["benchmark"] = {
                "observations": int(len(joined)),
                "beta": _r(beta),
                "alpha_annual": _r(alpha),
                "correlation": _r(joined["a"].corr(joined["b"])),
                "tracking_error": _r(te),
                "r_squared": _r(joined["a"].corr(joined["b"]) ** 2),
            }
    return out


def correlation_matrix(returns_df: pd.DataFrame) -> dict[str, Any]:
    clean = returns_df.dropna()
    if clean.shape[1] < 2 or len(clean) < 30:
        raise ValueError("Need at least 2 assets with 30 overlapping observations")
    c = clean.corr()
    return {
        "symbols": list(c.columns),
        "matrix": [[_r(v, 3) for v in row] for row in c.to_numpy()],
        "observations": int(len(clean)),
    }
