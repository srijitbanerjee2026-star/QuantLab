from pydantic import BaseModel
from typing import List, Dict, Any

class BacktestRequest(BaseModel):
    symbol: str
    strategy_type: str  # "sma_crossover" or "rsi_mean_reversion"
    initial_capital: float = 10000.0
    short_window: int = 20
    long_window: int = 50

class DailyPerformance(BaseModel):
    date: str
    price: float
    signal: int
    portfolio_value: float
    strategy_return: float

class BacktestResultResponse(BaseModel):
    symbol: str
    strategy_type: str
    initial_capital: float
    final_portfolio_value: float
    total_return_pct: float
    equity_curve: List[DailyPerformance]