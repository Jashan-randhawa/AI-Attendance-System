# Smart Attendance System — Backend

FastAPI backend for the Smart Attendance System.
Uses **InsightFace** (local, ONNX-based face recognition) + **MongoDB Atlas** (via Motor)
+ optional **Azure Blob Storage** for enrollment photo hosting.

> This file previously described an older Azure Face API + SQLite/PostgreSQL
> architecture that this codebase no longer implements. It has been rewritten to
> match the actual code in `main.py`, `core/database.py`, and `core/azure_face.py`.
> The root-level `../README.md` has the full architecture write-up, API reference,
> and deployment guides — this file is a quick-start companion for this folder.

---

## Project Structure

```
backend/
├── main.py                   ← FastAPI app, CORS, rate limiter, router registration
├── core/
│   ├── auth.py                ← Shared API-key dependency for protected endpoints
│   ├── azure_face.py          ← InsightFace wrapper + MongoDB-persisted embeddings
│   ├── database.py            ← Motor async client + index creation + DB helpers
│   ├── rate_limit.py          ← Shared slowapi Limiter instance
│   └── schemas.py              ← Pydantic v2 request/response schemas
├── routers/
│   ├── dashboard.py            ← GET /api/dashboard/metrics & /activity
│   ├── persons.py              ← CRUD + InsightFace enrollment (protected)
│   ├── sessions.py             ← Session create / list / end (create/end protected)
│   ├── attendance.py           ← Identify faces + mark attendance + export (mark/export protected)
│   └── reports.py              ← Daily stats, per-person rates, heatmap
├── requirements.txt
├── Dockerfile
├── .env.example
└── README.md
```

---

## Quick Start

### 1. Clone & install

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
# InsightFace compiles a Cython extension on first install — takes ~2-3 minutes.
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in MONGODB_URL and generate an API_KEY (see below).
```

**Generate an API key** (required — protected endpoints fail closed without one):

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Paste the output into `API_KEY=` in `.env`.

### 3. Run the server

```bash
uvicorn main:app --reload --port 8000
```

API docs available at: **http://localhost:8000/docs**

---

## Authentication (Phase 0 hardening)

Mutating and sensitive endpoints require an `X-API-Key` header matching the
`API_KEY` environment variable:

```bash
curl -X POST http://localhost:8000/api/sessions \
  -H "X-API-Key: <your key>" \
  -H "Content-Type: application/json" \
  -d '{"label": "CS101 Lecture"}'
```

If `API_KEY` is not set, these endpoints respond `503` rather than silently
allowing unauthenticated access. Read-only endpoints (list persons, dashboard,
reports, `/api/attendance/identify`) remain open for now — see the project's
`Remediation_Plan.md` for what's planned in later phases.

**Protected endpoints:**

| Method | Path |
|---|---|
| POST | `/api/persons/enroll` |
| POST | `/api/persons/enroll/analyze` |
| DELETE | `/api/persons/{id}` |
| GET | `/api/persons/debug-encodings` |
| GET | `/api/persons/debug-config` |
| POST | `/api/sessions` |
| PATCH | `/api/sessions/{id}/end` |
| POST | `/api/attendance/mark/{session_id}` |
| GET | `/api/attendance/export/csv` |

> **Frontend note:** the React app does not send this header yet. Until the
> frontend phase of the remediation plan lands, calls from the UI to the
> endpoints above will receive `401`/`503`. This is expected during the
> backend-only rollout.

---

## Rate Limiting

Per-IP limits are applied to the InsightFace-inference endpoints, since those
are the CPU-heavy, most abusable paths:

| Endpoint | Limit |
|---|---|
| `POST /api/persons/enroll` | 10/minute |
| `POST /api/persons/enroll/analyze` | 10/minute |
| `POST /api/attendance/identify` | 20/minute |
| `POST /api/attendance/mark/{session_id}` | 20/minute |

Exceeding the limit returns `429 Too Many Requests`.

---

## Upload Validation (Phase 1 hardening)

Every image upload (enrollment photos, live-attendance frames) is now:
1. Checked for a real `image/*` content type,
2. Capped at 10 MB per file (previously unbounded — a memory-exhaustion risk),
3. Actually decoded with Pillow to confirm it's a structurally valid image,
   not just a file that claims to be one via its `Content-Type` header.

Invalid uploads now return a clean `400` immediately (`core/validation.py`)
instead of failing deep inside the InsightFace pipeline with an opaque `503`.

## Request Correlation & Logging (Phase 1 hardening)

Every response includes an `X-Request-ID` header (client-supplied via the
same header, or auto-generated). All log lines for that request — including
ones emitted inside the InsightFace worker threads in `core/azure_face.py`
— are tagged `[req=<id>]`, so a single enrollment or attendance-mark call
can be traced end-to-end in the logs:

```
2026-01-01 10:00:00 [INFO] [req=a1b2c3d4e5f6] core.azure_face: Encoded face for 'Jane' photo 1 (det_score=0.94)
```

See `core/logging_context.py` for how context propagates into
`run_in_executor` calls, which is where most of the actual face-recognition
logging happens.

## Secrets Hygiene (Phase 1 hardening)

- `backend/.gitignore` now excludes `.env`, `venv/`, `__pycache__/`, and the
  local InsightFace model cache — none of these were excluded before.
- **Action for you to take once, manually:** if `MONGODB_URL` or
  `AZURE_STORAGE_CONNECTION_STRING` were ever shared in a `.env` file over
  chat, email, or a now-removed git commit, rotate those credentials in
  MongoDB Atlas / Azure now. This tooling change prevents *future* leaks; it
  can't undo a past one.
- In any deployed environment (Render, Azure App Service, etc.), set
  `API_KEY`, `MONGODB_URL`, and `AZURE_STORAGE_CONNECTION_STRING` via the
  platform's environment/secrets UI — never bake them into the Docker image
  or commit them to the repo.

## CI (Phase 1 hardening)

`.github/workflows/backend-ci.yml` runs on every push/PR touching `backend/`:
- **`pip-audit`** against `requirements.txt` — fails the build on any known
  CVE in a dependency.
- **Syntax + import check** — compiles every backend `.py` file and confirms
  all routers register their expected routes, without needing a real
  MongoDB or the ~300MB InsightFace model in CI.

A placeholder job for `pytest` is included (commented out) for when backend
tests are added — see `Remediation_Plan.md` item #11.

---

## API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` , `/health` | Health checks | — |
| GET | `/api/dashboard/metrics` | Total enrolled, sessions today, present today, rate | — |
| GET | `/api/dashboard/activity` | Latest 8 attendance events | — |
| GET | `/api/persons` | List all enrolled persons | — |
| GET | `/api/persons/{id}` | Get one person | — |
| POST | `/api/persons/enroll` | Enroll new person (multipart: name, email, department, photos) | ✅ |
| POST | `/api/persons/enroll/analyze` | Pre-enrollment photo quality check | ✅ |
| DELETE | `/api/persons/{id}` | Soft-delete person (keeps attendance history) | ✅ |
| GET | `/api/persons/debug-encodings` | Diagnostic: persons missing face encodings | ✅ |
| GET | `/api/persons/debug-config` | Diagnostic: validate Mongo/threshold config | ✅ |
| GET | `/api/sessions` | List sessions (`?active=true`) | — |
| POST | `/api/sessions` | Create a new session | ✅ |
| PATCH | `/api/sessions/{id}/end` | Close an active session | ✅ |
| POST | `/api/attendance/identify` | Identify faces in a frame (no DB write) | — |
| POST | `/api/attendance/mark/{session_id}` | Identify + mark attendance | ✅ |
| GET | `/api/attendance` | List records (filterable by date/session/person) | — |
| GET | `/api/attendance/export/csv` | Download records as CSV | ✅ |
| GET | `/api/reports/daily` | Daily attendance rate | — |
| GET | `/api/reports/persons` | Per-person attendance + defaulters list | — |
| GET | `/api/reports/heatmap` | Person × date matrix for heatmap | — |

---

## Database

MongoDB Atlas (or any MongoDB instance) via Motor, async. Falls back to
`mongodb://localhost:27017` if `MONGODB_URL` is unset — check
`GET /api/persons/debug-config` (with your API key) to confirm which one is
active.

Collections: `persons`, `sessions`, `attendance`, `face_encodings`. See the
root `../README.md` for full schema documentation and index details.

---

## Deployment

### Docker

```bash
docker build -t attendance-backend .
docker run -p 8000:8000 --env-file .env attendance-backend
```

The InsightFace `buffalo_sc` model is pre-downloaded at build time, so
container cold starts are fast (~2-3s instead of 60+s).

### Render / Azure App Service

See the root `../README.md` — deployment steps are identical for the backend
regardless of where the frontend is hosted. Remember to set `API_KEY` as a
secret environment variable on whichever platform you deploy to, not baked
into the image.

---

## Observability

- **Request correlation:** every log line includes `[req=<id>]` (see
  `core/logging_context.py`); the same ID is echoed back as the
  `X-Request-ID` response header.
- **Inference timing:** enroll, identify, and duplicate-check operations log
  a structured line via the `attendance.metrics` logger — e.g.
  `op=identify duration_ms=142.3 faces_detected=1 matches=1 ...`. Grep for
  `attendance.metrics` (or `op=identify` / `op=enroll` / `op=duplicate_check`)
  to pull timing data out of logs today; this is the seam to plug in
  Prometheus (`prometheus-fastapi-instrumentator`) later without touching
  call sites in `core/azure_face.py`.

## Known Limitations

- **Embedding store scaling (Remediation Plan item #13, deferred):**
  `core/azure_face.py::_load_all()` loads every enrolled person's face
  embeddings into memory on every identify/duplicate-check call — fine at
  tens-to-low-hundreds of enrolled people, not designed to scale to
  thousands. Deliberately left as-is until the `op=identify` timing logs
  above show it's an actual bottleneck; see the docstring on `_load_all`
  for the two remediation options (in-memory cache with invalidation, or a
  vector index) when that day comes.

## Testing

Backend unit tests live in `tests/` and cover the pure-ish, easy-to-silently-break
logic: face-matching thresholds, quality-check rejections, and the
attendance idempotency path. They mock InsightFace and MongoDB, so no model
download or live database is required.

```bash
pip install -r requirements.txt -r requirements-dev.txt
pytest -v
```

CI (`.github/workflows/backend-ci.yml`) runs these on every push/PR alongside
the dependency scan and import/route-registration smoke test.
