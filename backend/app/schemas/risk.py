from pydantic import BaseModel

class RiskAnalysisRequest(BaseModel):
    symbol: str
    risk_free_rate: float = 0.02  # 2% default risk-free rate

class RiskAnalysisResponse(BaseModel):
    symbol: str
    annualized_return: float
    annualized_volatility: float
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown: float
    var_95: float


class RiskReportRequest(BaseModel):
    symbol: str
    benchmark: str | None = "SPY"
    years: float = 3.0
    risk_free_rate: float = 0.02
    peers: list[str] = []  # optional extra tickers for the correlation matrix
