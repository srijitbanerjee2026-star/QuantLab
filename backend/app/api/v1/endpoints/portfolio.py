from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.portfolio import OptimizationRequest, PortfolioOptimizationResponse
from app.services import portfolio_service

router = APIRouter()

@router.post("/optimize", response_model=PortfolioOptimizationResponse)
def optimize_portfolio_allocation(payload: OptimizationRequest, db: Session = Depends(get_db)):
    try:
        results = portfolio_service.optimize_portfolio(
            db=db,
            symbols=payload.symbols,
            risk_free_rate=payload.risk_free_rate
        )
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")