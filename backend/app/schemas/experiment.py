from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime

class ExperimentCreate(BaseModel):
    name: str
    experiment_type: str
    parameters: Dict[str, Any]
    metrics: Dict[str, Any]

class ExperimentResponse(BaseModel):
    id: int
    name: str
    experiment_type: str
    parameters: Dict[str, Any]
    metrics: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True