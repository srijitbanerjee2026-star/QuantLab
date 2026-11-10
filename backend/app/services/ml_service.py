import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import mean_squared_error, r2_score, accuracy_score, precision_score
from sqlalchemy.orm import Session

from app.services.feature_service import calculate_quant_features

def train_and_predict(db: Session, symbol: str, model_type: str = "random_forest", test_size: float = 0.2) -> dict:
    # 1. Calculate quantitative features
    df = calculate_quant_features(db, symbol)
    if df.empty or len(df) < 50:
        raise ValueError(f"Insufficient data to train ML model for '{symbol}'. Requires at least 50 observations.")

    # 2. Target Generation (Next-day return & Next-day direction)
    df["target_return"] = df["log_return"].shift(-1)
    df["target_direction"] = np.where(df["target_return"] > 0, 1, 0)

    # Feature matrix (X) and clean missing rows due to shift/rolling windows
    features = ["simple_return", "log_return", "sma_20", "sma_50", "volatility_20d", "rsi_14", "macd", "macd_signal"]
    df_clean = df.dropna(subset=features + ["target_return"]).copy()

    X = df_clean[features]
    
    if model_type == "linear_regression":
        y = df_clean["target_return"]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, shuffle=False)
        
        model = LinearRegression()
        model.fit(X_train, y_train)
        
        y_pred = model.predict(X_test)
        mse = float(mean_squared_error(y_test, y_pred))
        r2 = float(r2_score(y_test, y_pred))
        
        metrics = {"mse": round(mse, 6), "r2_score": round(r2, 4)}
        
        latest_X = X.iloc[[-1]]
        pred_val = float(model.predict(latest_X)[0])
        latest_pred = {
            "predicted_next_day_return": round(pred_val, 6),
            "signal": "BUY" if pred_val > 0 else "SELL"
        }

    elif model_type == "random_forest":
        y = df_clean["target_direction"]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, shuffle=False)
        
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        model.fit(X_train, y_train)
        
        y_pred = model.predict(X_test)
        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred, zero_division=0))
        
        metrics = {"accuracy": round(acc, 4), "precision": round(prec, 4)}
        
        latest_X = X.iloc[[-1]]
        pred_dir = int(model.predict(latest_X)[0])
        prob = float(model.predict_proba(latest_X)[0][pred_dir])
        latest_pred = {
            "predicted_direction": "UP" if pred_dir == 1 else "DOWN",
            "confidence": round(prob, 4),
            "signal": "BUY" if pred_dir == 1 else "SELL"
        }

    else:
        raise ValueError(f"Unsupported model type: '{model_type}'")

    return {
        "symbol": symbol.upper(),
        "model_type": model_type,
        "metrics": metrics,
        "latest_prediction": latest_pred
    }