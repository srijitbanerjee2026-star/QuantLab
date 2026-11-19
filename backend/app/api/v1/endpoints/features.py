from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services import feature_service, market_data_service
from app.models.instrument import Instrument

router = APIRouter()

@router.get("/multi")
def get_multi_asset_analytics(
    symbols: str = Query("AAPL,MSFT,NVDA,SPY,GLD", description="Comma separated tickers"),
    db: Session = Depends(get_db)
):
    """Multi-asset analytics endpoint.
    Placed strictly above /{symbol} to prevent FastAPI matching 'multi' as a ticker.
    Returns cross-asset correlation matrix, cumulative returns, performance ranking, and rolling Sharpe.
    """
    try:
        sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
        return feature_service.get_multi_asset_features(db=db, symbols=sym_list)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Multi-asset computation failed: {str(e)}")

@router.get("/{symbol}")
def get_features(symbol: str, db: Session = Depends(get_db)):
    """Single-asset technical feature set (SMA, EMA, RSI, MACD, Volatility)."""
    sym = symbol.upper()
    inst = db.query(Instrument).filter(Instrument.symbol == sym).first()
    if not inst:
        try:
            db.add(Instrument(id=sym, symbol=sym, name=f"{sym} Stock", asset_class="Equity", region="US", currency="USD"))
            db.commit()
        except Exception:
            db.rollback()

    features = feature_service.calculate_features(db=db, symbol=sym)
    if not features:
        try:
            market_data_service.fetch_and_store_market_data(db=db, symbol=sym, start_date="2023-01-01")
            features = feature_service.calculate_features(db=db, symbol=sym)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Unable to load features for {sym}: {str(e)}")

    return features
