from pydantic import BaseModel
from datetime import datetime

class InstrumentBase(BaseModel):
    symbol: str
    name: str
    asset_class: str
    region: str
    currency: str

class InstrumentCreate(InstrumentBase):
    pass

class InstrumentResponse(InstrumentBase):
    id: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True