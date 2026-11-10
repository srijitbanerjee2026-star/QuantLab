from fastapi import APIRouter
from app.api.v1.endpoints import health, instruments, market_data, features, strategies, risk, portfolio, ml, experiments

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(instruments.router, prefix="/instruments", tags=["instruments"])
api_router.include_router(market_data.router, prefix="/market-data", tags=["market-data"])
api_router.include_router(features.router, prefix="/features", tags=["features"])
api_router.include_router(strategies.router, prefix="/strategies", tags=["strategies"])
api_router.include_router(risk.router, prefix="/risk", tags=["risk"])
api_router.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])
api_router.include_router(ml.router, prefix="/ml", tags=["ml"])
api_router.include_router(experiments.router, prefix="/experiments", tags=["experiments"])