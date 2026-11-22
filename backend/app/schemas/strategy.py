from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class BacktestRequest(BaseModel):
    symbol: str
    strategy_type: str  # "sma_crossover" or "rsi_mean_reversion"
    initial_capital: float = Field(10000.0, gt=0)
    short_window: int = Field(20, ge=2, le=250)
    long_window: int = Field(50, ge=3, le=500)
    # Optional extensions (all backwards compatible)
    start_date: Optional[str] = None  # YYYY-MM-DD
    end_date: Optional[str] = None
    cost_bps: float = Field(0.0, ge=0, le=500)  # commission + slippage per side, in basis points
    benchmark: Optional[str] = "SPY"
    rsi_low: float = 30.0
    rsi_high: float = 70.0


class DailyPerformance(BaseModel):
    date: str
    price: float
    signal: int
    portfolio_value: float
    strategy_return: float
    drawdown: float = 0.0
    buy_hold_value: Optional[float] = None
    benchmark_value: Optional[float] = None


class BacktestResultResponse(BaseModel):
    symbol: str
    strategy_type: str
    initial_capital: float
    final_portfolio_value: float
    total_return_pct: float
    equity_curve: List[DailyPerformance]
    metrics: Dict[str, Any] = {}
    trades: List[Dict[str, Any]] = []
    benchmark_symbol: Optional[str] = None
    benchmark_return_pct: Optional[float] = None
    params: Dict[str, Any] = {}
    data_source: str = "unknown"
