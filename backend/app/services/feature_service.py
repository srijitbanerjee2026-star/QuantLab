import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.models.market_data import MarketData
from app.models.instrument import Instrument
from app.services.market_data_service import get_market_data, fetch_and_store_market_data
import yfinance as yf

def calculate_quant_features(db: Session, symbol: str) -> pd.DataFrame:
    """Calculates technical and statistical quantitative features for a single symbol.
    Returns a DataFrame indexed by date with numeric features.
    DB-first caching with graceful yfinance fallback if DB is offline.
    """
    records = []
    try:
        records = get_market_data(db, symbol)
    except Exception as e:
        print(f"DB read error for {symbol}: {e}. Falling back to live fetch.")

    if not records:
        try:
            ticker = yf.Ticker(symbol)
            df_live = ticker.history(start="2023-01-01")
            if not df_live.empty:
                df_live.index = pd.to_datetime(df_live.index).date
                df = pd.DataFrame([
                    {
                        "date": idx,
                        "open": float(row["Open"]),
                        "high": float(row["High"]),
                        "low": float(row["Low"]),
                        "close": float(row["Close"]),
                        "adj_close": float(row.get("Adj Close", row["Close"])),
                        "volume": float(row["Volume"])
                    }
                    for idx, row in df_live.iterrows()
                ])
                df.set_index("date", inplace=True)
                df.sort_index(inplace=True)
            else:
                return pd.DataFrame()
        except Exception as live_err:
            print(f"Live fetch error for {symbol}: {live_err}")
            return pd.DataFrame()
    else:
        df = pd.DataFrame([
            {
                "date": r.date,
                "open": float(r.open),
                "high": float(r.high),
                "low": float(r.low),
                "close": float(r.close),
                "adj_close": float(r.adj_close),
                "volume": float(r.volume)
            }
            for r in records
        ])
        df.set_index("date", inplace=True)
        df.sort_index(inplace=True)

    if df.empty:
        return pd.DataFrame()

    # 1. Returns
    df["simple_return"] = df["adj_close"].pct_change()
    df["log_return"] = np.log(df["adj_close"] / df["adj_close"].shift(1))

    # 2. Moving Averages
    df["sma_20"] = df["adj_close"].rolling(window=20).mean()
    df["sma_50"] = df["adj_close"].rolling(window=50).mean()
    df["ema_12"] = df["adj_close"].ewm(span=12, adjust=False).mean()
    df["ema_26"] = df["adj_close"].ewm(span=26, adjust=False).mean()

    # 3. Volatility (Annualized 252 days)
    df["volatility_20d"] = df["simple_return"].rolling(window=20).std() * np.sqrt(252)

    # 4. RSI (14-day)
    delta = df["adj_close"].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / (loss.replace(0, np.nan))
    df["rsi_14"] = 100 - (100 / (1 + rs))

    # 5. MACD
    df["macd"] = df["ema_12"] - df["ema_26"]
    df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()

    # Replace NaN/Inf with 0 and ensure standard floats
    df = df.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    
    numeric_cols = ["adj_close", "simple_return", "log_return", "sma_20", "sma_50", "volatility_20d", "rsi_14", "macd", "macd_signal"]
    for col in numeric_cols:
        df[col] = df[col].astype(float)

    return df

def calculate_features(db: Session, symbol: str) -> List[Dict[str, Any]]:
    """Wrapper that returns list of dictionary records conforming to QuantFeatureResponse."""
    df = calculate_quant_features(db, symbol)
    if df.empty:
        return []
    
    records = []
    for date_idx, row in df.iterrows():
        date_val = date_idx.isoformat() if hasattr(date_idx, "isoformat") else str(date_idx)[:10]
        records.append({
            "date": date_val,
            "open": float(row.get("open", 0)),
            "high": float(row.get("high", 0)),
            "low": float(row.get("low", 0)),
            "close": float(row.get("close", 0)),
            "adj_close": float(row.get("adj_close", 0)),
            "volume": float(row.get("volume", 0)),
            "simple_return": float(row.get("simple_return", 0)),
            "log_return": float(row.get("log_return", 0)),
            "sma_20": float(row.get("sma_20", 0)),
            "sma_50": float(row.get("sma_50", 0)),
            "volatility_20d": float(row.get("volatility_20d", 0)),
            "rsi_14": float(row.get("rsi_14", 0)),
            "macd": float(row.get("macd", 0)),
            "macd_signal": float(row.get("macd_signal", 0))
        })
    return records

def get_multi_asset_features(db: Session, symbols: List[str]) -> Dict[str, Any]:
    """Computes cross-asset correlation, aligned cumulative returns starting at 0%,
    performance ranking, and 90-day rolling Sharpe ratios.
    DB-first caching with graceful yfinance fallback if DB is offline.
    """
    clean_symbols = [s.strip().upper() for s in symbols if s.strip()]
    if not clean_symbols:
        return {
            "symbols": [],
            "correlation": [],
            "cumulative_returns": [],
            "performance_ranking": [],
            "rolling_sharpe": []
        }

    price_df = pd.DataFrame()
    db_worked = False

    # 1. Attempt DB lookup & caching
    try:
        valid_symbols = []
        for sym in clean_symbols:
            inst = db.query(Instrument).filter(Instrument.symbol == sym).first()
            if not inst:
                try:
                    db.add(Instrument(id=sym, symbol=sym, name=f"{sym} Stock", asset_class="Equity", region="US", currency="USD"))
                    db.commit()
                except Exception:
                    db.rollback()

            has_data = db.query(MarketData).filter(MarketData.instrument_id == sym).first()
            if not has_data:
                try:
                    fetch_and_store_market_data(db=db, symbol=sym, start_date="2023-01-01")
                except Exception as e:
                    print(f"Skipping {sym} during multi-asset fetch: {e}")
                    continue

            if db.query(MarketData).filter(MarketData.instrument_id == sym).first():
                valid_symbols.append(sym)

        if valid_symbols:
            query = db.query(MarketData).filter(MarketData.instrument_id.in_(valid_symbols))
            df = pd.read_sql(query.statement, db.bind)
            if not df.empty:
                price_df = df.pivot(index="date", columns="instrument_id", values="adj_close").sort_index()
                db_worked = True
    except Exception as db_err:
        print(f"DB multi-asset query failed: {db_err}. Falling back to direct yfinance batch.")

    # 2. Fallback to direct yfinance download if DB was empty or failed
    if not db_worked or price_df.empty or len(price_df) < 2:
        try:
            raw_data = yf.download(clean_symbols, start="2023-01-01", progress=False)
            if not raw_data.empty:
                if "Adj Close" in raw_data.columns:
                    price_df = raw_data["Adj Close"]
                elif "Close" in raw_data.columns:
                    price_df = raw_data["Close"]
                else:
                    price_df = raw_data
                if isinstance(price_df, pd.Series):
                    price_df = price_df.to_frame(name=clean_symbols[0])
        except Exception as yf_err:
            print(f"yfinance batch download error: {yf_err}")

    if price_df.empty or len(price_df) < 2:
        return {
            "symbols": clean_symbols,
            "correlation": [],
            "cumulative_returns": [],
            "performance_ranking": [],
            "rolling_sharpe": []
        }

    price_df = price_df.ffill().bfill().dropna(how="all").dropna(axis=1, how="all")
    active_symbols = [str(c) for c in price_df.columns if str(c) in clean_symbols]
    if not active_symbols:
        active_symbols = [str(c) for c in price_df.columns]

    price_df = price_df[active_symbols]
    returns_df = price_df.pct_change().dropna(how="all").fillna(0)

    # 3. Correlation Matrix
    corr_matrix = returns_df.corr().fillna(0).round(2)
    corr_data = [
        {"symbol": s1, **{s2: float(corr_matrix.loc[s1, s2]) for s2 in active_symbols}}
        for s1 in active_symbols
    ]

    # 4. Cumulative Returns (%) - Starting aligned at 0%
    cum_returns = ((1 + returns_df).cumprod() - 1) * 100
    cum_returns_data = []
    
    first_date = price_df.index[0]
    first_date_str = first_date.strftime("%Y-%m-%d") if hasattr(first_date, "strftime") else str(first_date)[:10]
    cum_returns_data.append({"date": first_date_str, **{sym: 0.0 for sym in active_symbols}})

    for date, row in cum_returns.iterrows():
        date_str = date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date)[:10]
        entry = {"date": date_str}
        for sym in active_symbols:
            entry[sym] = round(float(row[sym]), 2)
        cum_returns_data.append(entry)

    # 5. Overall Performance Ranking (Total Return %)
    total_returns = (((price_df.iloc[-1] / price_df.iloc[0]) - 1) * 100).fillna(0).round(2)
    perf_ranking = sorted(
        [{"symbol": sym, "return_pct": float(total_returns[sym])} for sym in active_symbols],
        key=lambda x: x["return_pct"],
        reverse=True
    )

    # 6. Rolling Sharpe Ratio (90-Day Window, Annualized)
    window = min(90, max(5, len(returns_df) - 1))
    rolling_mean = returns_df.rolling(window=window).mean() * np.sqrt(252)
    rolling_std = returns_df.rolling(window=window).std() * np.sqrt(252)
    rolling_sharpe = (rolling_mean / rolling_std.replace(0, np.nan)).replace([np.inf, -np.inf], np.nan).fillna(0).round(2)

    rolling_sharpe_data = []
    for date, row in rolling_sharpe.iloc[window:].iterrows():
        date_str = date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else str(date)[:10]
        entry = {"date": date_str}
        for sym in active_symbols:
            entry[sym] = float(row[sym])
        rolling_sharpe_data.append(entry)

    return {
        "symbols": active_symbols,
        "correlation": corr_data,
        "cumulative_returns": cum_returns_data,
        "performance_ranking": perf_ranking,
        "rolling_sharpe": rolling_sharpe_data
    }
