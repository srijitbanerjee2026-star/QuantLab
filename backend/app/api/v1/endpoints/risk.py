from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.risk import RiskAnalysisRequest, RiskAnalysisResponse
from app.services import risk_service

router = APIRouter()

@router.post("/analyze", response_model=RiskAnalysisResponse)
def get_risk_metrics(payload: RiskAnalysisRequest, db: Session = Depends(get_db)):
    metrics = risk_service.calculate_risk_metrics(
        db=db,
        symbol=payload.symbol,
        risk_free_rate=payload.risk_free_rate
    )
    if not metrics:
        raise HTTPException(status_code=404, detail=f"No market data available to compute risk metrics for '{payload.symbol}'.")
    return metrics