from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from app.core.database import get_db
from app.schemas.market_data import MarketDataResponse
from app.services import market_data_service

router = APIRouter()

@router.post("/fetch/{symbol}", status_code=status.HTTP_200_OK)
def fetch_historical_prices(
    symbol: str, 
    start_date: str = Query("2020-01-01", description="Format: YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    try:
        count = market_data_service.fetch_and_store_historical_data(db, symbol, start_date)
        return {"symbol": symbol.upper(), "records_ingested": count, "status": "success"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch market data: {str(e)}")

@router.get("/{symbol}", response_model=List[MarketDataResponse])
def get_historical_prices(
    symbol: str,
    start_date: date = Query(None),
    end_date: date = Query(None),
    db: Session = Depends(get_db)
):
    return market_data_service.get_market_data(db, symbol, start_date, end_date)