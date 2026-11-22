from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"project": "QuantLab", "status": "running"}

def test_health_check():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_market_rejects_bad_params():
    r = client.get("/api/v1/market/history/AAPL?period=bogus")
    assert r.status_code == 400


def test_new_risk_and_frontier_validate_input():
    assert client.post("/api/v1/risk/report", json={"symbol": "AAPL", "years": 99}).status_code == 400
    assert client.post("/api/v1/portfolio/frontier", json={"symbols": ["AAPL"], "years": 99}).status_code == 400


def test_ml_evaluate_validates_input():
    assert client.post("/api/v1/ml/evaluate", json={"symbol": "AAPL", "years": 1}).status_code == 400


def test_analysis_validates_input():
    assert client.get("/api/v1/analysis/technicals/AAPL?years=99").status_code == 422
