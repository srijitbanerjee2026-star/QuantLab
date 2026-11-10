import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from app.services.feature_service import calculate_quant_features

def run_backtest(
    db: Session, 
    symbol: str, 
    strategy_type: str = "sma_crossover", 
    initial_capital: float = 10000.0,
    short_w: int = 20,
    long_w: int = 50
) -> dict:
    # 1. Fetch computed market features
    df = calculate_quant_features(db, symbol)
    if df.empty:
        return {}

    # Reset index to have date as a column
    df = df.reset_index()

    # 2. Strategy Signal Generation
    if strategy_type == "sma_crossover":
        df["sma_short"] = df["adj_close"].rolling(window=short_w).mean().fillna(0)
        df["sma_long"] = df["adj_close"].rolling(window=long_w).mean().fillna(0)
        
        # 1 = Long (Buy), 0 = Cash/Out
        df["signal"] = np.where(df["sma_short"] > df["sma_long"], 1, 0)
    elif strategy_type == "rsi_mean_reversion":
        # Buy when oversold (<30), sell when overbought (>70)
        conditions = [df["rsi_14"] < 30, df["rsi_14"] > 70]
        choices = [1, 0]
        df["signal"] = np.select(conditions, choices, default=0)
    else:
        raise ValueError(f"Unsupported strategy type: {strategy_type}")

    # Shift signal by 1 day to prevent lookahead bias (trade on next open/close)
    df["position"] = df["signal"].shift(1).fillna(0)

    # 3. Calculate Returns & Portfolio Value
    df["strategy_daily_return"] = df["position"] * df["simple_return"]
    df["cumulative_strategy_return"] = (1 + df["strategy_daily_return"]).cumprod()
    df["portfolio_value"] = initial_capital * df["cumulative_strategy_return"]

    # 4. Prepare Output Serialization
    final_val = float(df["portfolio_value"].iloc[-1])
    total_ret_pct = float(((final_val - initial_capital) / initial_capital) * 100)

    equity_curve = []
    for _, row in df.iterrows():
        equity_curve.append({
            "date": str(row["date"]),
            "price": float(row["adj_close"]),
            "signal": int(row["signal"]),
            "portfolio_value": float(row["portfolio_value"]),
            "strategy_return": float(row["strategy_daily_return"])
        })

    return {
        "symbol": symbol.upper(),
        "strategy_type": strategy_type,
        "initial_capital": float(initial_capital),
        "final_portfolio_value": round(final_val, 2),
        "total_return_pct": round(total_ret_pct, 2),
        "equity_curve": equity_curve
    }