from fastapi import FastAPI
from app.api.v1.router import api_router
from app.core.database import engine, Base
import app.models  # Registers models with Base.metadata

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="QuantLab API",
    description="Quantitative Research Workstation Engine",
    version="0.1.0"
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"project": "QuantLab", "status": "running"}