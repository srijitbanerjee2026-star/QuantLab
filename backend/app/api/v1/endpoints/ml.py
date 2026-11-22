from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.ml import ModelTrainRequest, ModelTrainResponse, ModelEvaluateRequest
from app.services import ml_service
from app.services.ml_engine import walk_forward
from app.services.price_loader import load_ohlcv

router = APIRouter()

@router.post("/train", response_model=ModelTrainResponse)
def train_prediction_model(payload: ModelTrainRequest, db: Session = Depends(get_db)):
    try:
        results = ml_service.train_and_predict(
            db=db,
            symbol=payload.symbol,
            model_type=payload.model_type,
            test_size=payload.test_size
        )
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model training failed: {str(e)}")


@router.post("/evaluate")
def evaluate_model(payload: ModelEvaluateRequest):
    """Walk-forward, out-of-sample evaluation of a next-day direction model for any ticker (Yahoo data)."""
    if not 2 <= payload.years <= 15:
        raise HTTPException(status_code=400, detail="years must be between 2 and 15")
    sym = payload.symbol.strip().upper()
    try:
        prices = load_ohlcv(sym, payload.years)
        res = walk_forward(prices, payload.model_type, payload.min_train, payload.step, payload.cost_bps)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    res["symbol"] = sym
    res["data_source"] = "yfinance (adjusted close, daily)"
    return res
