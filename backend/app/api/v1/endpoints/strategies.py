from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.strategy import BacktestRequest, BacktestResultResponse
from app.services import strategy_service

router = APIRouter()

@router.post("/backtest", response_model=BacktestResultResponse)
def execute_backtest(payload: BacktestRequest, db: Session = Depends(get_db)):
    try:
        results = strategy_service.run_backtest(
            db=db,
            symbol=payload.symbol,
            strategy_type=payload.strategy_type,
            initial_capital=payload.initial_capital,
            short_w=payload.short_window,
            long_w=payload.long_window,
            start_date=payload.start_date,
            end_date=payload.end_date,
            cost_bps=payload.cost_bps,
            benchmark=payload.benchmark,
            rsi_low=payload.rsi_low,
            rsi_high=payload.rsi_high,
        )
        if not results:
            raise HTTPException(status_code=404, detail=f"No market data found for '{payload.symbol}'.")
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))