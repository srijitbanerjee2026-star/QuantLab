from sqlalchemy import Column, Integer, String, Float, DateTime, JSON
from datetime import datetime
from app.core.database import Base

class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(Integer, primary_order=True, primary_key=True, index=True)
    name = Column(String, index=True)
    experiment_type = Column(String, index=True)  # "backtest", "ml_model", "portfolio_opt"
    parameters = Column(JSON, nullable=False)
    metrics = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)