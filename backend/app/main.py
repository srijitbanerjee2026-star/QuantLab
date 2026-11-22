from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError
from app.api.v1.router import api_router

app = FastAPI(title="QuantLab API", version="1.0.0")

# Allow requests from Next.js frontend
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(OperationalError)
async def db_unavailable(_: Request, __: OperationalError):
    # Handled below the CORS middleware, so the browser sees a clean 503 instead of a CORS error.
    return JSONResponse(status_code=503, content={"detail": "Database unavailable"})


app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"project": "QuantLab", "status": "running"}