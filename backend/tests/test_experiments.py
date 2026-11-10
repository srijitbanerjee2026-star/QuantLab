from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_experiment_logging_and_retrieval():
    payload = {
        "name": "AAPL SMA Crossover Run 1",
        "experiment_type": "backtest",
        "parameters": {"symbol": "AAPL", "short_window": 20, "long_window": 50},
        "metrics": {"total_return_pct": 14.5, "sharpe_ratio": 1.25}
    }
    post_resp = client.post("/api/v1/experiments/", json=payload)
    assert post_resp.status_code == 200
    data = post_resp.json()
    assert data["name"] == payload["name"]

    get_resp = client.get("/api/v1/experiments/?experiment_type=backtest")
    assert get_resp.status_code == 200
    experiments = get_resp.json()
    assert len(experiments) > 0