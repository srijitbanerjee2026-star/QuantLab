from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_risk_metrics():
    payload = {"symbol": "AAPL", "risk_free_rate": 0.02}
    response = client.post("/api/v1/risk/analyze", json=payload)
    assert response.status_code == 200
    res = response.json()
    assert res["symbol"] == "AAPL"
    assert "sharpe_ratio" in res
    assert "max_drawdown" in res