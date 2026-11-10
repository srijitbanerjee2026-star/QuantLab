from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_portfolio_optimization():
    # Ensure two assets are ingested
    for sym in ["AAPL", "MSFT"]:
        client.post("/api/v1/instruments/", json={"symbol": sym, "name": sym, "asset_class": "Equity", "region": "US", "currency": "USD"})
        client.post(f"/api/v1/market-data/fetch/{sym}?start_date=2024-01-01")

    payload = {"symbols": ["AAPL", "MSFT"], "risk_free_rate": 0.02}
    response = client.post("/api/v1/portfolio/optimize", json=payload)
    assert response.status_code == 200
    res = response.json()
    assert "max_sharpe" in res
    assert "min_volatility" in res
    assert sum(res["max_sharpe"]["weights"].values()) == 1.0