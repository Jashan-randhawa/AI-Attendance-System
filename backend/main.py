"""
Smart Attendance System — FastAPI Backend (MongoDB + InsightFace)

Phase 0 hardening (see Remediation_Plan.md):
  - API-key auth on mutating/sensitive endpoints (core/auth.py)
  - Per-IP rate limiting on expensive face-recognition endpoints (slowapi)
  - Defensive ObjectId parsing (no more unhandled 500s on bad session IDs)
  - /api/persons/debug-azure now reports the env vars actually used

Phase 1 hardening:
  - Upload validation: real image decode + size cap, not just content-type (core/validation.py)
  - Request-ID middleware + structured log correlation (core/logging_context.py)
  - backend/.gitignore added (no secrets/venv/cache protection existed before)
  - Dependency scanning wired into CI (.github/workflows/backend-ci.yml)

Phase 2 hardening:
  - Backend unit tests for face-matching thresholds, quality-check rejections,
    and mark_attendance idempotency (backend/tests/, wired into CI)
  - Timing metrics on the InsightFace-heavy path: enroll/identify/duplicate-check
    now log structured op=... duration_ms=... lines (core/azure_face.py)
  - Embedding-store scaling (_load_all) documented as a known, deferred
    limitation rather than fixed — see its docstring and backend/README.md

Phase 3 hardening:
  - RBAC: operator vs admin API keys (core/auth.py) — operators can create/end
    sessions and mark attendance; only admins can enroll/delete persons,
    export data, or hit /debug-* endpoints
  - CORS wildcard guard: startup now hard-fails if ALLOWED_ORIGINS ever
    resolves to "*" while allow_credentials=True (_resolve_cors_origins)
  - Disaster recovery runbook added: see ../docs/DISASTER_RECOVERY.md
"""

import os
import logging
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from core.database import init_db
from core.rate_limit import limiter
from core.logging_context import RequestIDMiddleware, install_request_id_filter
from routers import persons, sessions, attendance, reports, dashboard

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)
install_request_id_filter()


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
    version="4.2.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(RequestIDMiddleware)


def _resolve_cors_origins() -> list:
    """
    Build the CORS allow-list (Remediation Plan item #16 — CORS tightening).

    `allow_credentials=True` is required below (the frontend sends the
    X-API-Key header on protected calls), and per the CORS spec + Starlette's
    own implementation, `allow_origins=["*"]` combined with
    `allow_credentials=True` is a real vulnerability: it tells browsers to
    accept cross-origin credentialed requests from ANY site, effectively
    disabling the same-origin protections auth is supposed to provide.

    Previously this was "reasonable defaults, double-check no wildcard ever
    ends up here" — a manual-review-only safeguard. This function makes it a
    startup-time hard failure instead: a wildcard in ALLOWED_ORIGINS now
    crashes app startup with a clear error rather than silently deploying an
    open CORS policy.
    """
    default_origins = [
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
        "https://ai-attendance-system-mauve.vercel.app",
    ]
    env_origins = os.getenv("ALLOWED_ORIGINS", "")
    extra = [o.strip() for o in env_origins.split(",") if o.strip()]

    origins = list(dict.fromkeys(default_origins + extra))  # de-dupe, keep order

    if "*" in origins:
        raise RuntimeError(
            "ALLOWED_ORIGINS resolved to include '*' (wildcard). This is refused "
            "at startup because allow_credentials=True is set below — a wildcard "
            "origin combined with credentialed requests would accept "
            "cross-origin, authenticated calls from any website. List explicit "
            "origins in ALLOWED_ORIGINS instead (comma-separated)."
        )

    logger.info("CORS allow_origins resolved to: %s", origins)
    return origins


allow_origins = _resolve_cors_origins()

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
