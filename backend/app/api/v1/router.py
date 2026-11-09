from fastapi import APIRouter
from app.api.v1.endpoints import health, instruments, market_data

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(instruments.router, prefix="/instruments", tags=["instruments"])
api_router.include_router(market_data.router, prefix="/market-data", tags=["market-data"])