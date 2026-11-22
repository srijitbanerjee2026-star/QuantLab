"""Pure backtest engine: no database or network access, so it is fully unit-testable.

Input DataFrame columns: date, adj_close, simple_return, rsi_14.
Positions are long/flat only. The signal is shifted one bar to avoid lookahead bias.
"""
from __future__ import annotations

from typing import Any, Optional

import numpy as np
import pandas as pd

TRADING_DAYS = 252
STRATEGIES = {"sma_crossover", "rsi_mean_reversion"}


def _signals(df: pd.DataFrame, strategy_type: str, short_w: int, long_w: int, rsi_low: float, rsi_high: float) -> pd.Series:
    if strategy_type == "sma_crossover":
        if short_w >= long_w:
            raise ValueError("short_window must be smaller than long_window")
        short = df["adj_close"].rolling(short_w).mean()
        long_ = df["adj_close"].rolling(long_w).mean()
        return ((short > long_) & long_.notna()).astype(int)
    if strategy_type == "rsi_mean_reversion":
        if not 0 < rsi_low < rsi_high < 100:
            raise ValueError("rsi thresholds must satisfy 0 < low < high < 100")
        # Enter when oversold, hold until overbought (stateful, not a one-day pulse)
        state = 0
        out = []
        for v in df["rsi_14"].to_numpy():
            if v == v:  # not NaN
                if v < rsi_low:
                    state = 1
                elif v > rsi_high:
                    state = 0
            out.append(state)
        return pd.Series(out, index=df.index)
    raise ValueError(f"Unsupported strategy type: {strategy_type}")


def _extract_trades(df: pd.DataFrame, cost_frac: float) -> list[dict[str, Any]]:
    """Round-trip trades from changes in `signal` (entry/exit at that bar's close)."""
    trades: list[dict[str, Any]] = []
    entry_i: Optional[int] = None
    sig = df["signal"].to_numpy()
    price = df["adj_close"].to_numpy()
    dates = df["date"].astype(str).to_numpy()
    prev = 0
    for i, s in enumerate(sig):
        if s == 1 and prev == 0:
            entry_i = i
        elif s == 0 and prev == 1 and entry_i is not None:
            trades.append(_trade(dates, price, entry_i, i, cost_frac, open_=False))
            entry_i = None
        prev = s
    if entry_i is not None:
        trades.append(_trade(dates, price, entry_i, len(sig) - 1, cost_frac, open_=True))
    return trades


def _trade(dates, price, i0: int, i1: int, cost_frac: float, open_: bool) -> dict[str, Any]:
    ret = price[i1] / price[i0] - 1 - 2 * cost_frac
    return {
        "entry_date": str(dates[i0]),
        "exit_date": str(dates[i1]),
        "entry_price": round(float(price[i0]), 4),
        "exit_price": round(float(price[i1]), 4),
        "return_pct": round(float(ret) * 100, 3),
        "holding_days": int(i1 - i0),
        "open": open_,
    }


def simulate(
    df: pd.DataFrame,
    strategy_type: str = "sma_crossover",
    initial_capital: float = 10000.0,
    short_w: int = 20,
    long_w: int = 50,
    rsi_low: float = 30.0,
    rsi_high: float = 70.0,
    cost_bps: float = 0.0,
    start: Optional[str] = None,
    end: Optional[str] = None,
) -> tuple[pd.DataFrame, list[dict[str, Any]], dict[str, Any]]:
    """Run the strategy. Indicators are computed on the full history (warm-up), then sliced to [start, end]."""
    if initial_capital <= 0:
        raise ValueError("initial_capital must be positive")
    if cost_bps < 0:
        raise ValueError("cost_bps cannot be negative")
    if strategy_type not in STRATEGIES:
        raise ValueError(f"Unsupported strategy type: {strategy_type}")

    d = df.copy().reset_index(drop=True)
    d["date"] = pd.to_datetime(d["date"])
    d["signal"] = _signals(d, strategy_type, short_w, long_w, rsi_low, rsi_high)

    if start:
        d = d[d["date"] >= pd.to_datetime(start)]
    if end:
        d = d[d["date"] <= pd.to_datetime(end)]
    d = d.reset_index(drop=True)
    if len(d) < 2:
        raise ValueError("Not enough data in the selected date range")

    cost_frac = cost_bps / 10000.0
    d["position"] = d["signal"].shift(1).fillna(0)
    turnover = d["position"].diff().abs().fillna(d["position"].abs())  # entering on bar 0 also pays
    d["strategy_return"] = d["position"] * d["simple_return"].fillna(0) - turnover * cost_frac
    d["portfolio_value"] = initial_capital * (1 + d["strategy_return"]).cumprod()
    d["drawdown"] = d["portfolio_value"] / d["portfolio_value"].cummax() - 1
    d["buy_hold_value"] = initial_capital * d["adj_close"] / d["adj_close"].iloc[0]

    trades = _extract_trades(d, cost_frac)
    return d, trades, _metrics(d, trades, initial_capital)


def _metrics(d: pd.DataFrame, trades: list[dict[str, Any]], capital: float) -> dict[str, Any]:
    r = d["strategy_return"]
    n = len(d)
    final = float(d["portfolio_value"].iloc[-1])
    years = max(n / TRADING_DAYS, 1e-9)
    total = final / capital - 1
    cagr = (final / capital) ** (1 / years) - 1 if final > 0 else -1.0
    std = float(r.std(ddof=1)) if n > 2 else 0.0
    down = r[r < 0]
    dstd = float(down.std(ddof=1)) if len(down) > 2 else 0.0
    max_dd = float(d["drawdown"].min())
    closed = [t for t in trades if not t["open"]]
    wins = [t["return_pct"] for t in closed if t["return_pct"] > 0]
    losses = [t["return_pct"] for t in closed if t["return_pct"] <= 0]

    def safe(x: float) -> Optional[float]:
        return round(float(x), 4) if np.isfinite(x) else None

    bh_total = float(d["buy_hold_value"].iloc[-1]) / capital - 1
    return {
        "total_return_pct": safe(total * 100),
        "cagr_pct": safe(cagr * 100),
        "annual_volatility_pct": safe(std * np.sqrt(TRADING_DAYS) * 100),
        "sharpe_ratio": safe(r.mean() / std * np.sqrt(TRADING_DAYS)) if std > 0 else None,
        "sortino_ratio": safe(r.mean() / dstd * np.sqrt(TRADING_DAYS)) if dstd > 0 else None,
        "max_drawdown_pct": safe(max_dd * 100),
        "calmar_ratio": safe(cagr / abs(max_dd)) if max_dd < 0 else None,
        "total_trades": len(trades),
        "win_rate_pct": safe(len(wins) / len(closed) * 100) if closed else None,
        "profit_factor": safe(sum(wins) / abs(sum(losses))) if losses and sum(losses) != 0 else None,
        "exposure_pct": safe(float((d["position"] > 0).mean()) * 100),
        "buy_hold_return_pct": safe(bh_total * 100),
        "trading_days": n,
    }
