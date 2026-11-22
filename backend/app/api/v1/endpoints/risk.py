from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.risk import RiskAnalysisRequest, RiskAnalysisResponse, RiskReportRequest
from app.services import risk_service
from app.services.price_loader import load_closes, benchmark_returns
from app.services.risk_engine import risk_report, correlation_matrix

router = APIRouter()

@router.post("/analyze", response_model=RiskAnalysisResponse)
def get_risk_metrics(payload: RiskAnalysisRequest, db: Session = Depends(get_db)):
    metrics = risk_service.calculate_risk_metrics(
        db=db,
        symbol=payload.symbol,
        risk_free_rate=payload.risk_free_rate
    )
    if not metrics:
        raise HTTPException(status_code=404, detail=f"No market data available to compute risk metrics for '{payload.symbol}'.")
    return metrics


@router.post("/report")
def full_risk_report(payload: RiskReportRequest):
    """Full risk report for any ticker (Yahoo Finance data; does not use the database)."""
    if not 0.25 <= payload.years <= 10:
        raise HTTPException(status_code=400, detail="years must be between 0.25 and 10")
    sym = payload.symbol.strip().upper()
    try:
        closes = load_closes([sym], payload.years)
        returns = closes[sym].pct_change().dropna()
        bench_sym = (payload.benchmark or "").strip().upper() or None
        bench = benchmark_returns(bench_sym, payload.years) if bench_sym and bench_sym != sym else None
        report = risk_report(returns, bench, payload.risk_free_rate)
        report["symbol"] = sym
        report["benchmark_symbol"] = bench_sym if bench is not None else None
        report["correlation"] = None
        peers = [p.strip().upper() for p in payload.peers if p.strip() and p.strip().upper() != sym][:9]
        if peers:
            frame = load_closes([sym] + peers, payload.years).pct_change().dropna(how="any")
            report["correlation"] = correlation_matrix(frame)
        report["data_source"] = "yfinance (adjusted close, daily)"
        return report
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
