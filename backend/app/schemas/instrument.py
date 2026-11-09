from pydantic import BaseModel, ConfigDict
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

    model_config = ConfigDict(from_attributes=True)