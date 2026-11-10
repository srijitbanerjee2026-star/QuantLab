from pydantic import BaseModel
from typing import List, Dict

class OptimizationRequest(BaseModel):
    symbols: List[str]
    risk_free_rate: float = 0.02

class PortfolioWeightsResponse(BaseModel):
    weights: Dict[str, float]
    expected_return: float
    volatility: float
    sharpe_ratio: float

class PortfolioOptimizationResponse(BaseModel):
    symbols: List[str]
    equal_weight: PortfolioWeightsResponse
    max_sharpe: PortfolioWeightsResponse
    min_volatility: PortfolioWeightsResponse