from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.schemas.experiment import ExperimentCreate, ExperimentResponse
from app.services import experiment_service

router = APIRouter()

@router.post("/", response_model=ExperimentResponse)
def log_experiment(payload: ExperimentCreate, db: Session = Depends(get_db)):
    return experiment_service.save_experiment(db=db, experiment_in=payload)

@router.get("/", response_model=List[ExperimentResponse])
def list_experiments(
    experiment_type: Optional[str] = Query(None, description="Filter by 'backtest', 'ml_model', or 'portfolio_opt'"),
    db: Session = Depends(get_db)
):
    return experiment_service.get_experiments(db=db, experiment_type=experiment_type)