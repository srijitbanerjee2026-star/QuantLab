from typing import Optional

import pandas as pd
import yfinance as yf
from sqlalchemy.orm import Session

from app.services.backtest_engine import simulate
from app.services.feature_service import calculate_quant_features


def _benchmark_series(symbol: str, dates: pd.Series) -> Optional[pd.Series]:
    """Adjusted close of the benchmark aligned to the strategy dates (forward-filled)."""
    try:
        start, end = dates.min(), dates.max() + pd.Timedelta(days=1)
        h = yf.Ticker(symbol).history(start=str(start.date()), end=str(end.date()), auto_adjust=True)
        if h is None or h.empty:
            return None
        s = h["Close"]
        s.index = pd.to_datetime(s.index).tz_localize(None).normalize()
        return s.reindex(pd.DatetimeIndex(dates).normalize(), method="ffill").bfill()
    except Exception:
        return None


def run_backtest(
    db: Session,
    symbol: str,
    strategy_type: str = "sma_crossover",
    initial_capital: float = 10000.0,
    short_w: int = 20,
    long_w: int = 50,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    cost_bps: float = 0.0,
    benchmark: Optional[str] = "SPY",
    rsi_low: float = 30.0,
    rsi_high: float = 70.0,
) -> dict:
    feats = calculate_quant_features(db, symbol)
    if feats.empty:
        return {}
    df = feats.reset_index()

    sim, trades, metrics = simulate(
        df,
        strategy_type=strategy_type,
        initial_capital=initial_capital,
        short_w=short_w,
        long_w=long_w,
        rsi_low=rsi_low,
        rsi_high=rsi_high,
        cost_bps=cost_bps,
        start=start_date,
        end=end_date,
    )

    bench_vals = None
    bench_ret = None
    if benchmark:
        b = _benchmark_series(benchmark.upper(), sim["date"])
        if b is not None and b.iloc[0] > 0:
            bench_vals = (initial_capital * b / b.iloc[0]).to_numpy()
            bench_ret = round(float(bench_vals[-1] / initial_capital - 1) * 100, 4)

    curve = []
    for i, row in enumerate(sim.itertuples(index=False)):
        curve.append({
            "date": row.date.strftime("%Y-%m-%d"),
            "price": float(row.adj_close),
            "signal": int(row.signal),
            "portfolio_value": float(row.portfolio_value),
            "strategy_return": float(row.strategy_return),
            "drawdown": float(row.drawdown),
            "buy_hold_value": float(row.buy_hold_value),
            "benchmark_value": float(bench_vals[i]) if bench_vals is not None else None,
        })

    final_val = float(sim["portfolio_value"].iloc[-1])
    return {
        "symbol": symbol.upper(),
        "strategy_type": strategy_type,
        "initial_capital": float(initial_capital),
        "final_portfolio_value": round(final_val, 2),
        "total_return_pct": round((final_val / initial_capital - 1) * 100, 2),
        "equity_curve": curve,
        "metrics": metrics,
        "trades": trades,
        "benchmark_symbol": benchmark.upper() if bench_vals is not None else None,
        "benchmark_return_pct": bench_ret,
        "params": {
            "short_window": short_w,
            "long_window": long_w,
            "rsi_low": rsi_low,
            "rsi_high": rsi_high,
            "cost_bps": cost_bps,
            "start_date": start_date,
            "end_date": end_date,
        },
        "data_source": "yfinance (adjusted close, daily)",
    }
