from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.ml import ModelTrainRequest, ModelTrainResponse
from app.services import ml_service

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