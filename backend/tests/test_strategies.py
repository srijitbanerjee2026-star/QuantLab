from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_strategy_backtest():
    # 1. Ingest asset data
    inst_payload = {"symbol": "AAPL", "name": "Apple Inc.", "asset_class": "Equity", "region": "US", "currency": "USD"}
    client.post("/api/v1/instruments/", json=inst_payload)
    client.post("/api/v1/market-data/fetch/AAPL?start_date=2024-01-01")

    # 2. Run Backtest
    request_data = {
        "symbol": "AAPL",
        "strategy_type": "sma_crossover",
        "initial_capital": 10000.0,
        "short_window": 20,
        "long_window": 50
    }
    response = client.post("/api/v1/strategies/backtest", json=request_data)
    assert response.status_code == 200
    res = response.json()
    assert res["symbol"] == "AAPL"
    assert "final_portfolio_value" in res
    assert len(res["equity_curve"]) > 0