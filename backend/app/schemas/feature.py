from pydantic import BaseModel
from datetime import date

class QuantFeatureResponse(BaseModel):
    date: date
    adj_close: float
    simple_return: float
    log_return: float
    sma_20: float
    sma_50: float
    volatility_20d: float
    rsi_14: float
    macd: float
    macd_signal: float