from pydantic import BaseModel, ConfigDict
from datetime import date
from decimal import Decimal

class MarketDataBase(BaseModel):
    date: date
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    adj_close: Decimal
    volume: int

class MarketDataCreate(MarketDataBase):
    instrument_id: str

class MarketDataResponse(MarketDataBase):
    id: str
    instrument_id: str

    model_config = ConfigDict(from_attributes=True)