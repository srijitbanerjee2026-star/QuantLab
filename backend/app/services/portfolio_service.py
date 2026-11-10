from typing import List
import numpy as np
import pandas as pd
from scipy.optimize import minimize
from sqlalchemy.orm import Session
from app.services.market_data_service import get_market_data

def optimize_portfolio(db: Session, symbols: List[str], risk_free_rate: float = 0.02) -> dict:
    symbols = [s.upper() for s in symbols]
    price_dict = {}

    # 1. Fetch price histories for all requested symbols
    for sym in symbols:
        records = get_market_data(db, sym)
        if records:
            df = pd.DataFrame([{"date": r.date, "adj_close": float(r.adj_close)} for r in records])
            df.set_index("date", inplace=True)
            price_dict[sym] = df["adj_close"]

    if len(price_dict) < 2:
        raise ValueError("Portfolio optimization requires at least 2 valid asset price histories.")

    # 2. Align prices into a single DataFrame and calculate returns
    prices_df = pd.DataFrame(price_dict).dropna()
    returns_df = prices_df.pct_change().dropna()

    mean_returns = returns_df.mean() * 252
    cov_matrix = returns_df.cov() * 252
    num_assets = len(symbols)

    def portfolio_performance(weights):
        weights = np.array(weights)
        p_return = np.sum(mean_returns * weights)
        p_volatility = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
        sharpe = (p_return - risk_free_rate) / p_volatility if p_volatility != 0 else 0
        return p_return, p_volatility, sharpe

    # Constraints & Bounds (Weights sum to 1, no short-selling: 0 <= weight <= 1)
    constraints = ({'type': 'eq', 'fun': lambda w: np.sum(w) - 1})
    bounds = tuple((0.0, 1.0) for _ in range(num_assets))
    init_weights = num_assets * [1.0 / num_assets]

    # Equal Weight Baseline
    eq_ret, eq_vol, eq_sharpe = portfolio_performance(init_weights)
    equal_weight_res = {
        "weights": {sym: round(1.0 / num_assets, 4) for sym in symbols},
        "expected_return": round(float(eq_ret), 4),
        "volatility": round(float(eq_vol), 4),
        "sharpe_ratio": round(float(eq_sharpe), 4)
    }

    # Max Sharpe Optimization
    def neg_sharpe(weights):
        return -portfolio_performance(weights)[2]

    opt_sharpe = minimize(neg_sharpe, init_weights, method='SLSQP', bounds=bounds, constraints=constraints)
    max_s_weights = opt_sharpe.x
    ms_ret, ms_vol, ms_sharpe = portfolio_performance(max_s_weights)
    max_sharpe_res = {
        "weights": {sym: round(float(w), 4) for sym, w in zip(symbols, max_s_weights)},
        "expected_return": round(float(ms_ret), 4),
        "volatility": round(float(ms_vol), 4),
        "sharpe_ratio": round(float(ms_sharpe), 4)
    }

    # Min Volatility Optimization
    def min_vol(weights):
        return portfolio_performance(weights)[1]

    opt_vol = minimize(min_vol, init_weights, method='SLSQP', bounds=bounds, constraints=constraints)
    min_v_weights = opt_vol.x
    mv_ret, mv_vol, mv_sharpe = portfolio_performance(min_v_weights)
    min_vol_res = {
        "weights": {sym: round(float(w), 4) for sym, w in zip(symbols, min_v_weights)},
        "expected_return": round(float(mv_ret), 4),
        "volatility": round(float(mv_vol), 4),
        "sharpe_ratio": round(float(mv_sharpe), 4)
    }

    return {
        "symbols": symbols,
        "equal_weight": equal_weight_res,
        "max_sharpe": max_sharpe_res,
        "min_volatility": min_vol_res
    }