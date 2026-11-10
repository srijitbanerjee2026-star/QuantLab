from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.experiment import Experiment
from app.schemas.experiment import ExperimentCreate

def save_experiment(db: Session, experiment_in: ExperimentCreate) -> Experiment:
    db_exp = Experiment(
        name=experiment_in.name,
        experiment_type=experiment_in.experiment_type,
        parameters=experiment_in.parameters,
        metrics=experiment_in.metrics
    )
    db.add(db_exp)
    db.commit()
    db.refresh(db_exp)
    return db_exp

def get_experiments(db: Session, experiment_type: Optional[str] = None) -> List[Experiment]:
    query = db.query(Experiment)
    if experiment_type:
        query = query.filter(Experiment.experiment_type == experiment_type)
    return query.order_by(Experiment.created_at.desc()).all()