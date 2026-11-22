"""Leak-free walk-forward evaluation of next-day direction models. Pure: no database or network.

Design rules
- Features use only information available at the close of day t (stationary ratios/returns, no raw price levels).
- The label for day t is whether the return on day t+1 is positive.
- Walk-forward: an expanding window is retrained every `step` days; each fold predicts only the days AFTER its
  training data, and the last training label is purged so no training label overlaps the first test day.
- Metrics are computed on out-of-sample predictions only and are compared against the base rate.
"""
from __future__ import annotations

from typing import Any, Optional

import numpy as np
import pandas as pd
from scipy.stats import binomtest
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, precision_score, recall_score, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

TRADING_DAYS = 252
MODELS = {"logistic_regression", "random_forest", "gradient_boosting"}

FEATURES = [
    "ret_1", "ret_5", "ret_10", "ret_20",
    "vol_10", "vol_20", "rsi_14",
    "dist_sma_20", "dist_sma_50", "macd_pct", "macd_hist_pct",
    "vol_ratio",
]


def build_features(prices: pd.DataFrame) -> pd.DataFrame:
    """`prices`: date-indexed with `Close` (adjusted) and optional `Volume`. Returns features + `next_ret` label source."""
    close = prices["Close"].astype(float)
    ret = close.pct_change()
    f = pd.DataFrame(index=prices.index)
    f["ret_1"] = ret
    f["ret_5"] = close.pct_change(5)
    f["ret_10"] = close.pct_change(10)
    f["ret_20"] = close.pct_change(20)
    f["vol_10"] = ret.rolling(10).std()
    f["vol_20"] = ret.rolling(20).std()

    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    f["rsi_14"] = 100 - 100 / (1 + rs)
    f.loc[(loss == 0) & (gain > 0), "rsi_14"] = 100.0

    f["dist_sma_20"] = close / close.rolling(20).mean() - 1
    f["dist_sma_50"] = close / close.rolling(50).mean() - 1
    macd = close.ewm(span=12, adjust=False).mean() - close.ewm(span=26, adjust=False).mean()
    sig = macd.ewm(span=9, adjust=False).mean()
    f["macd_pct"] = macd / close
    f["macd_hist_pct"] = (macd - sig) / close

    if "Volume" in prices and prices["Volume"].astype(float).sum() > 0:
        v = prices["Volume"].astype(float).replace(0, np.nan)
        f["vol_ratio"] = v / v.rolling(20).mean() - 1
    else:
        f["vol_ratio"] = 0.0

    f["next_ret"] = ret.shift(-1)  # label source: the NEXT day's return
    return f.replace([np.inf, -np.inf], np.nan)


def make_model(model_type: str):
    if model_type == "logistic_regression":
        return make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=500))
    if model_type == "random_forest":
        return RandomForestClassifier(n_estimators=200, max_depth=4, min_samples_leaf=20, n_jobs=-1, random_state=42)
    if model_type == "gradient_boosting":
        return HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=150, min_samples_leaf=30, random_state=42)
    raise ValueError(f"Unsupported model type: '{model_type}'")


def _importance(model, features: list[str]) -> dict[str, float]:
    if hasattr(model, "feature_importances_"):
        imp = np.asarray(model.feature_importances_, dtype=float)
    elif hasattr(model, "named_steps") and hasattr(model.named_steps.get("logisticregression"), "coef_"):
        imp = np.abs(model.named_steps["logisticregression"].coef_[0])
    else:
        return {}
    total = imp.sum()
    imp = imp / total if total > 0 else imp
    return {k: round(float(v), 4) for k, v in sorted(zip(features, imp), key=lambda kv: -kv[1])}


def walk_forward(
    prices: pd.DataFrame,
    model_type: str = "random_forest",
    min_train: int = 252,
    step: int = 21,
    cost_bps: float = 5.0,
) -> dict[str, Any]:
    if model_type not in MODELS:
        raise ValueError(f"Unsupported model type: '{model_type}'")
    if step < 5 or min_train < 60:
        raise ValueError("step must be >= 5 and min_train >= 60")

    feats = build_features(prices)
    latest_row = feats[FEATURES].iloc[[-1]]
    data = feats.dropna(subset=FEATURES + ["next_ret"]).copy()
    n = len(data)
    if n < min_train + step * 2:
        raise ValueError(
            f"Not enough history: {n} usable rows, need at least {min_train + step * 2} (try a longer lookback or smaller min_train)"
        )

    X = data[FEATURES].to_numpy()
    y = (data["next_ret"] > 0).astype(int).to_numpy()

    probs = np.full(n, np.nan)
    folds = []
    start = min_train
    while start < n:
        end = min(start + step, n)
        # Purge the last training row: its label (next-day return) is the first test day's return.
        train_end = start - 1
        if len(np.unique(y[:train_end])) < 2:
            start = end
            continue
        model = make_model(model_type)
        model.fit(X[:train_end], y[:train_end])
        probs[start:end] = model.predict_proba(X[start:end])[:, 1]
        folds.append({"train_end": str(data.index[train_end - 1])[:10], "test_start": str(data.index[start])[:10], "test_end": str(data.index[end - 1])[:10], "n_train": int(train_end)})
        start = end

    oos = ~np.isnan(probs)
    yo, po = y[oos], probs[oos]
    pred = (po > 0.5).astype(int)
    base_up = float(yo.mean())
    majority_acc = max(base_up, 1 - base_up)
    acc = float((pred == yo).mean())
    k = int((pred == yo).sum())
    # Is accuracy better than the majority-class baseline? (one-sided binomial test)
    p_value = float(binomtest(k, len(yo), majority_acc, alternative="greater").pvalue)

    nret = data["next_ret"].to_numpy()[oos]
    pos = pred.astype(float)
    turnover = np.abs(np.diff(np.concatenate([[0.0], pos])))
    strat = pos * nret - turnover * cost_bps / 10000.0
    strat_curve = np.cumprod(1 + strat)
    bh_curve = np.cumprod(1 + nret)
    s_std = float(strat.std(ddof=1)) if len(strat) > 2 else 0.0
    dates = [str(d)[:10] for d in data.index[oos]]

    def dd(c):
        return float((c / np.maximum.accumulate(c) - 1).min())

    metrics = {
        "oos_observations": int(oos.sum()),
        "accuracy": round(acc, 4),
        "base_rate_up": round(base_up, 4),
        "majority_baseline_accuracy": round(majority_acc, 4),
        "accuracy_edge": round(acc - majority_acc, 4),
        "edge_p_value": round(p_value, 4),
        "precision_up": round(float(precision_score(yo, pred, zero_division=0)), 4),
        "recall_up": round(float(recall_score(yo, pred, zero_division=0)), 4),
        "auc": round(float(roc_auc_score(yo, po)), 4) if len(np.unique(yo)) == 2 else None,
        "brier": round(float(brier_score_loss(yo, po)), 4),
        "pct_days_long": round(float(pos.mean()), 4),
        "strategy_return": round(float(strat_curve[-1] - 1), 4),
        "buy_hold_return": round(float(bh_curve[-1] - 1), 4),
        "strategy_sharpe": round(float(strat.mean() / s_std * np.sqrt(TRADING_DAYS)), 3) if s_std > 0 else None,
        "strategy_max_drawdown": round(dd(strat_curve), 4),
        "buy_hold_max_drawdown": round(dd(bh_curve), 4),
    }

    final = make_model(model_type)
    final.fit(X, y)
    p_up = float(final.predict_proba(latest_row.to_numpy())[0, 1]) if not latest_row.isna().any(axis=1).iloc[0] else None

    return {
        "model_type": model_type,
        "features": FEATURES,
        "n_rows": int(n),
        "n_folds": len(folds),
        "first_test_date": dates[0],
        "last_test_date": dates[-1],
        "metrics": metrics,
        "feature_importance": _importance(final, FEATURES),
        "latest": {
            "as_of": str(prices.index[-1])[:10],
            "prob_up": round(p_up, 4) if p_up is not None else None,
            "signal": None if p_up is None else ("LONG" if p_up > 0.5 else "FLAT"),
        },
        "equity_curve": [
            {"date": d, "strategy": round(float(s), 5), "buy_hold": round(float(b), 5)}
            for d, s, b in zip(dates, strat_curve, bh_curve)
        ],
        "folds": folds[-5:],
        "params": {"min_train": min_train, "step": step, "cost_bps": cost_bps},
    }
