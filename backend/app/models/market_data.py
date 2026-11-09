from sqlalchemy import Column, String, Date, Numeric, BigInteger, ForeignKey, Index
from app.core.database import Base

class MarketData(Base):
    __tablename__ = "market_data"

    id = Column(String, primary_key=True, index=True)  # e.g., "AAPL_2026-03-30"
    instrument_id = Column(String, ForeignKey("instruments.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    open = Column(Numeric(18, 4), nullable=False)
    high = Column(Numeric(18, 4), nullable=False)
    low = Column(Numeric(18, 4), nullable=False)
    close = Column(Numeric(18, 4), nullable=False)
    adj_close = Column(Numeric(18, 4), nullable=False)
    volume = Column(BigInteger, nullable=False)

    __table_args__ = (
        Index("idx_instrument_date", "instrument_id", "date", unique=True),
    )