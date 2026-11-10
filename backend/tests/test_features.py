from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_features():
    # 1. Ensure AAPL is registered in the instrument database
    inst_payload = {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "asset_class": "Equity",
        "region": "US",
        "currency": "USD"
    }
    client.post("/api/v1/instruments/", json=inst_payload)

    # 2. Fetch market data so features can be computed from actual rows
    fetch_resp = client.post("/api/v1/market-data/fetch/AAPL?start_date=2024-01-01")
    assert fetch_resp.status_code == 200

    # 3. Retrieve computed quantitative features
    response = client.get("/api/v1/features/AAPL")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) > 0
    assert "rsi_14" in data[0]
    assert "volatility_20d" in data[0]
    assert "macd" in data[0]