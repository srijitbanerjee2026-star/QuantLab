from pydantic import BaseModel
from typing import Dict, Any

class ModelTrainRequest(BaseModel):
    symbol: str
    model_type: str = "random_forest"  # "linear_regression" or "random_forest"
    test_size: float = 0.2

class ModelTrainResponse(BaseModel):
    symbol: str
    model_type: str
    metrics: Dict[str, float]
    latest_prediction: Dict[str, Any]