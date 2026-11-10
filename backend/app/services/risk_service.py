import numpy as np
import pandas as pd
from scipy.stats import norm
from sqlalchemy.orm import Session
from app.services.feature_service import calculate_quant_features

def calculate_risk_metrics(db: Session, symbol: str, risk_free_rate: float = 0.02) -> dict:
    df = calculate_quant_features(db, symbol)
    if df.empty:
        return {}

    returns = df["simple_return"].dropna()
    returns = returns[returns != 0]  # Filter initial zero-padding

    if len(returns) == 0:
        return {}

    # 1. Annualized Return & Volatility
    trading_days = 252
    mean_daily_return = returns.mean()
    annualized_return = (1 + mean_daily_return) ** trading_days - 1
    annualized_volatility = returns.std() * np.sqrt(trading_days)

    # 2. Sharpe Ratio
    sharpe_ratio = (annualized_return - risk_free_rate) / annualized_volatility if annualized_volatility != 0 else 0.0

    # 3. Sortino Ratio (Downside deviation only)
    downside_returns = returns[returns < 0]
    downside_std = downside_returns.std() * np.sqrt(trading_days)
    sortino_ratio = (annualized_return - risk_free_rate) / downside_std if downside_std != 0 else 0.0

    # 4. Maximum Drawdown
    cumulative = (1 + returns).cumprod()
    running_max = cumulative.cummax()
    drawdown = (cumulative - running_max) / running_max
    max_drawdown = float(drawdown.min())

    # 5. Value at Risk (95% Parametric VaR)
    var_95 = float(norm.ppf(0.05, mean_daily_return, returns.std()))

    return {
        "symbol": symbol.upper(),
        "annualized_return": round(float(annualized_return), 4),
        "annualized_volatility": round(float(annualized_volatility), 4),
        "sharpe_ratio": round(float(sharpe_ratio), 4),
        "sortino_ratio": round(float(sortino_ratio), 4),
        "max_drawdown": round(max_drawdown, 4),
        "var_95": round(var_95, 4)
    }