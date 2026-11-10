import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from app.services.market_data_service import get_market_data

def calculate_quant_features(db: Session, symbol: str) -> pd.DataFrame:
    records = get_market_data(db, symbol)
    if not records:
        return pd.DataFrame()

    df = pd.DataFrame([
        {
            "date": r.date,
            "open": float(r.open),
            "high": float(r.high),
            "low": float(r.low),
            "close": float(r.close),
            "adj_close": float(r.adj_close),
            "volume": r.volume
        }
        for r in records
    ])
    
    df.set_index("date", inplace=True)
    df.sort_index(inplace=True)

    # 1. Returns
    df["simple_return"] = df["adj_close"].pct_change()
    df["log_return"] = np.log(df["adj_close"] / df["adj_close"].shift(1))

    # 2. Moving Averages
    df["sma_20"] = df["adj_close"].rolling(window=20).mean()
    df["sma_50"] = df["adj_close"].rolling(window=50).mean()
    df["ema_12"] = df["adj_close"].ewm(span=12, adjust=False).mean()
    df["ema_26"] = df["adj_close"].ewm(span=26, adjust=False).mean()

    # 3. Volatility (Annualized)
    df["volatility_20d"] = df["simple_return"].rolling(window=20).std() * np.sqrt(252)

    # 4. RSI (14-day)
    delta = df["adj_close"].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df["rsi_14"] = 100 - (100 / (1 + rs))

    # 5. MACD
    df["macd"] = df["ema_12"] - df["ema_26"]
    df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()

    # Replace NaN/Inf with 0 and convert types to standard Python float
    df = df.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    
    numeric_cols = ["adj_close", "simple_return", "log_return", "sma_20", "sma_50", "volatility_20d", "rsi_14", "macd", "macd_signal"]
    for col in numeric_cols:
        df[col] = df[col].astype(float)

    return df