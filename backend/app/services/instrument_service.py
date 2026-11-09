from sqlalchemy.orm import Session
from app.models.instrument import Instrument
from app.schemas.instrument import InstrumentCreate

def get_instrument_by_symbol(db: Session, symbol: str):
    return db.query(Instrument).filter(Instrument.symbol == symbol.upper()).first()

def get_all_instruments(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Instrument).offset(skip).limit(limit).all()

def create_instrument(db: Session, instrument_in: InstrumentCreate):
    db_instrument = Instrument(
        id=instrument_in.symbol.upper(),
        symbol=instrument_in.symbol.upper(),
        name=instrument_in.name,
        asset_class=instrument_in.asset_class,
        region=instrument_in.region,
        currency=instrument_in.currency
    )
    db.add(db_instrument)
    db.commit()
    db.refresh(db_instrument)
    return db_instrument