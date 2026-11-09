from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_market_data_flow():
    # 1. Ensure instrument exists
    inst_payload = {
        "symbol": "MSFT",
        "name": "Microsoft Corporation",
        "asset_class": "Equity",
        "region": "US",
        "currency": "USD"
    }
    client.post("/api/v1/instruments/", json=inst_payload)

    # 2. Fetch historical data from yfinance
    fetch_resp = client.post("/api/v1/market-data/fetch/MSFT?start_date=2024-01-01")
    assert fetch_resp.status_code == 200
    assert fetch_resp.json()["records_ingested"] > 0

    # 3. Read back ingested prices
    get_resp = client.get("/api/v1/market-data/MSFT")
    assert get_resp.status_code == 200
    assert len(get_resp.json()) > 0