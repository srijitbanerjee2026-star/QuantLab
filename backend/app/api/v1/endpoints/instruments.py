from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.schemas.instrument import InstrumentCreate, InstrumentResponse
from app.services import instrument_service

router = APIRouter()

@router.post("/", response_model=InstrumentResponse, status_code=status.HTTP_201_CREATED)
def create_new_instrument(
    instrument_in: InstrumentCreate, 
    db: Session = Depends(get_db)
):
    existing = instrument_service.get_instrument_by_symbol(db, symbol=instrument_in.symbol)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Instrument with symbol '{instrument_in.symbol}' already exists."
        )
    return instrument_service.create_instrument(db=db, instrument_in=instrument_in)

@router.get("/", response_model=List[InstrumentResponse])
def list_instruments(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    return instrument_service.get_all_instruments(db=db, skip=skip, limit=limit)