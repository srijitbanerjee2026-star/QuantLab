from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_and_read_instrument():
    payload = {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "asset_class": "Equity",
        "region": "US",
        "currency": "USD"
    }
    
    # POST new instrument
    response = client.post("/api/v1/instruments/", json=payload)
    assert response.status_code in [201, 400]  # 201 created or 400 if already exists in Supabase
    
    # GET list of instruments
    list_response = client.get("/api/v1/instruments/")
    assert list_response.status_code == 200
    assert len(list_response.json()) > 0