from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_ml_prediction():
    # Ensure AAPL has data ingested
    client.post("/api/v1/instruments/", json={"symbol": "AAPL", "name": "Apple Inc.", "asset_class": "Equity", "region": "US", "currency": "USD"})
    client.post("/api/v1/market-data/fetch/AAPL?start_date=2023-01-01")

    payload = {"symbol": "AAPL", "model_type": "random_forest", "test_size": 0.2}
    response = client.post("/api/v1/ml/train", json=payload)
    assert response.status_code == 200
    res = response.json()
    assert res["symbol"] == "AAPL"
    assert "accuracy" in res["metrics"]
    assert "latest_prediction" in res