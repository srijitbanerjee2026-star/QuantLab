from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.portfolio import OptimizationRequest, PortfolioOptimizationResponse, FrontierRequest
from app.services import portfolio_service
from app.services.price_loader import load_returns
from app.services.optimizer_engine import optimise

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


@router.post("/frontier")
def efficient_frontier(payload: FrontierRequest):
    """Max-Sharpe, min-volatility, equal-weight and the efficient frontier for any basket of tickers."""
    if not 0.5 <= payload.years <= 10:
        raise HTTPException(status_code=400, detail="years must be between 0.5 and 10")
    try:
        returns = load_returns(payload.symbols, payload.years)
        result = optimise(returns, payload.risk_free_rate, payload.max_weight)
        result["data_source"] = "yfinance (adjusted close, daily)"
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
