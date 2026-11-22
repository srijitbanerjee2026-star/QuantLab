from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db

router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "healthy"}

@router.get("/health/db")
def db_health_check(db: Session = Depends(get_db)):
    try:
        result = db.execute(text("SELECT 1")).fetchone()
        if result and result[0] == 1:
            return {"database_status": "connected", "engine": "PostgreSQL (Supabase)"}
        return {"database_status": "error", "details": "Unexpected query result"}
    except Exception as e:
        raise HTTPException(status_code=503, detail="Database disconnected")