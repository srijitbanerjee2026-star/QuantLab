from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import math

from app.core.database import get_db
from app.schemas.feature import QuantFeatureResponse
from app.services import feature_service

router = APIRouter()

@router.get("/{symbol}", response_model=List[QuantFeatureResponse])
def get_computed_features(symbol: str, db: Session = Depends(get_db)):
    df = feature_service.calculate_quant_features(db, symbol)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No market data found for '{symbol}'.")
    
    df_reset = df.reset_index()
    records = df_reset.to_dict(orient="records")
    
    # Sanitize dictionary values for Pydantic V2 validation
    cleaned_records = []
    for row in records:
        cleaned_row = {}
        for k, v in row.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                cleaned_row[k] = 0.0
            else:
                cleaned_row[k] = v
        cleaned_records.append(cleaned_row)
        
    return cleaned_records