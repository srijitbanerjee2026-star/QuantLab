import yfinance as yf
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from datetime import date
from app.models.market_data import MarketData
from app.models.instrument import Instrument

def fetch_and_store_historical_data(db: Session, symbol: str, start_date: str = "2020-01-01"):
    # 1. Verify instrument exists in database
    instrument = db.query(Instrument).filter(Instrument.symbol == symbol.upper()).first()
    if not instrument:
        raise ValueError(f"Instrument '{symbol}' must be registered before fetching data.")

    # 2. Download daily prices via yfinance
    ticker = yf.Ticker(symbol)
    df = ticker.history(start=start_date)

    if df.empty:
        return 0

    # 3. Prepare records for bulk insert/upsert
    records = []
    for current_date, row in df.iterrows():
        obs_date = current_date.date()
        record_id = f"{symbol.upper()}_{obs_date.strftime('%Y-%m-%d')}"
        
        records.append({
            "id": record_id,
            "instrument_id": symbol.upper(),
            "date": obs_date,
            "open": round(float(row["Open"]), 4),
            "high": round(float(row["High"]), 4),
            "low": round(float(row["Low"]), 4),
            "close": round(float(row["Close"]), 4),
            "adj_close": round(float(row.get("Adj Close", row["Close"])), 4),
            "volume": int(row["Volume"])
        })

    # 4. Perform PostgreSQL bulk upsert (Do Nothing on Conflict)
    if records:
        stmt = insert(MarketData).values(records)
        stmt = stmt.on_conflict_do_nothing(index_elements=["instrument_id", "date"])
        db.execute(stmt)
        db.commit()

    return len(records)

def get_market_data(db: Session, symbol: str, start_date: date = None, end_date: date = None):
    query = db.query(MarketData).filter(MarketData.instrument_id == symbol.upper())
    if start_date:
        query = query.filter(MarketData.date >= start_date)
    if end_date:
        query = query.filter(MarketData.date <= end_date)
    return query.order_by(MarketData.date.asc()).all()