from fastapi import APIRouter
from app.api.v1.endpoints import health, instruments, market_data, features, analytics_pro, strategies, risk, portfolio, ml, experiments, market, analysis, assistant

api_router = APIRouter()
api_router.include_router(market.router, prefix="/market", tags=["market"])
api_router.include_router(health.router, tags=["health"])
api_router.include_router(instruments.router, prefix="/instruments", tags=["instruments"])
api_router.include_router(market_data.router, prefix="/market-data", tags=["market-data"])
api_router.include_router(features.router, prefix="/features", tags=["features"])
api_router.include_router(analytics_pro.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(strategies.router, prefix="/strategies", tags=["strategies"])
api_router.include_router(risk.router, prefix="/risk", tags=["risk"])
api_router.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])
api_router.include_router(ml.router, prefix="/ml", tags=["ml"])
api_router.include_router(experiments.router, prefix="/experiments", tags=["experiments"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["assistant"])
