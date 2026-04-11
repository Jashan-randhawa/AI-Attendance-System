"""
Smart Attendance System — FastAPI Backend (MongoDB + InsightFace)
"""

import os
import logging
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.database import init_db
from routers import persons, sessions, attendance, reports, dashboard

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def _preload_insightface():
    """Pre-warm InsightFace model and MongoDB face store at startup."""
    try:
        from core.azure_face import _get_insight_app, _get_col
        _get_insight_app()
        _get_col()   # warm up the synchronous MongoDB client for face_encodings
        logger.info("✅ InsightFace model and MongoDB face store ready.")
    except Exception as e:
        logger.warning("Pre-load warning (non-fatal): %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _preload_insightface)

    mongo_url = os.getenv("MONGODB_URL", "")
    if not mongo_url:
        logger.warning("MONGODB_URL not set — using localhost!")

    logger.info("=== Startup complete. Ready to serve requests. ===")
    yield


app = FastAPI(
    title="Smart Attendance System API",
    description="InsightFace + MongoDB powered attendance backend",
    version="4.0.0",
    lifespan=lifespan,
)

_default_origins = [
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:5173",
    "https://ai-attendance-system-mauve.vercel.app",
]
_env_origins = os.getenv("ALLOWED_ORIGINS", "")
_extra = [o.strip() for o in _env_origins.split(",") if o.strip()]
allow_origins = list(set(_default_origins + _extra))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router,  prefix="/api/dashboard",  tags=["Dashboard"])
app.include_router(persons.router,    prefix="/api/persons",    tags=["Persons"])
app.include_router(sessions.router,   prefix="/api/sessions",   tags=["Sessions"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["Attendance"])
app.include_router(reports.router,    prefix="/api/reports",    tags=["Reports"])


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "message": "Smart Attendance System API is running"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}
