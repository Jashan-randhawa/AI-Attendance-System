# Remediation Plan — Smart Attend Backend

Applying the audit framework from *Backend Architecture and Weak-Point Analysis* to the
actual codebase (FastAPI + MongoDB + InsightFace), mapped against the specific gaps found
during code review.

Ordered by severity × effort, so you can work top-down.

---

## Phase 0 — Fix now (High severity, Small effort)

### 1. Add authentication to every mutating endpoint
**Why:** Right now anyone with the URL can enroll people, delete records, or export all
attendance data. This is the single biggest gap.
**How:**
- Add an API-key or JWT dependency (`Depends(require_auth)`) to `persons.py` (enroll/delete),
  `sessions.py` (create/end), `attendance.py` (mark), and `reports.py`/CSV export.
- Minimal version: a shared-secret header (`X-API-Key`) checked against an env var — fast to
  ship, closes the door immediately.
- Proper version: issue JWTs per operator/admin, validate signature + expiry in a FastAPI
  dependency, gate by role (operator vs admin) since "delete person" and "mark attendance"
  shouldn't need the same privilege.
**Effort:** S (shared-secret) → M (JWT + roles)

### 2. Remove or fix `/api/persons/debug-azure`
**Why:** It checks `AZURE_FACE_KEY`/`AZURE_FACE_ENDPOINT`, env vars the InsightFace pipeline
never reads. It will always report "NOT SET" and gives operators false signal during an
incident.
**How:** Either delete the endpoint, or rewrite it to check the vars actually used
(`MONGODB_URL`, `MIN_CONFIDENCE`, `DUPLICATE_THRESHOLD`, `AZURE_STORAGE_CONNECTION_STRING`).
**Effort:** S

### 3. Guard malformed `ObjectId` inputs
**Why:** `mark_attendance`, `get_session`, and `end_session` call `ObjectId(session_id)`
directly. A malformed ID (typo, bot probe) throws an uncaught `InvalidId` → unhandled 500
instead of a clean 400/404.
**How:** Wrap in try/except:
```python
try:
    oid = ObjectId(session_id)
except InvalidId:
    raise HTTPException(400, "Invalid session_id format.")
```
Apply the same pattern anywhere a path/query param is cast to `ObjectId`.
**Effort:** S

### 4. Reconcile the two READMEs
**Why:** `backend/README.md` describes a different, older stack (Azure Face API + SQLite)
than the code that actually runs. Anyone onboarding will follow the wrong setup instructions.
**How:** Delete or fully rewrite `backend/README.md` to match `main.py`/`database.py`, or
just delete it and keep the root README as the single source of truth.
**Effort:** S

### 5. Add basic rate limiting
**Why:** No throttling on `/api/attendance/mark`, `/api/persons/enroll`, or anywhere else.
Each of those triggers a CPU-heavy InsightFace inference — a handful of concurrent abusive
requests can exhaust a small instance.
**How:** Add `slowapi` (Starlette/FastAPI-friendly rate limiter) with per-IP limits on the
expensive endpoints (enroll, identify, mark). Something like 10 req/min/IP is a reasonable
starting point for a demo/portfolio deployment.
**Effort:** S

---

## Phase 1 — High/Medium severity, Medium effort

### 6. Secrets management hygiene
**Why:** `MONGODB_URL` and `AZURE_STORAGE_CONNECTION_STRING` currently live in `.env` files.
Fine for local dev, risky if `.env` ever gets committed or the same secret is reused across
environments.
**How:**
- Confirm `.env` is git-ignored (check `.gitattributes`/`.gitignore` — verify it's actually
  excluded, not just assumed).
- In production (Render/Azure), set these via the platform's secret/environment config UI,
  never baked into the Docker image.
- Rotate the Mongo Atlas and Azure Storage credentials once, now, to invalidate anything that
  may have leaked during dev/demo sharing.
**Effort:** S–M

### 7. Input validation pass on file uploads
**Why:** `persons.py`/`attendance.py` only check `content_type.startswith("image/")`, which
is client-supplied and trivially spoofed. A malicious upload could smuggle a non-image
payload past this check.
**How:** After reading bytes, validate with Pillow (`Image.open(...).verify()`) before
passing to InsightFace — this is already partially covered by `_bytes_to_bgr` throwing on
bad input, but wrap it in a clean 400 response instead of a 503. Also cap upload size
(FastAPI doesn't limit by default) to prevent memory-exhaustion via huge file uploads.
**Effort:** S

### 8. Dependency scanning in CI
**Why:** `requirements.txt` has no automated CVE checking. `insightface`, `onnxruntime`,
`opencv-python-headless`, and `pymongo` are exactly the kind of native-extension-heavy
packages that accumulate CVEs.
**How:** Add a GitHub Action step:
```yaml
- run: pip install pip-audit && pip-audit -r backend/requirements.txt
```
or use `snyk test --file=backend/requirements.txt`. Same for `npm audit` on the frontend
`package-lock.json`. Run on every PR; fail the build on High/Critical.
**Effort:** S (once CI exists) — see #10 below if CI doesn't exist yet.

### 9. Structured logging + request correlation
**Why:** Current logs are plain `logger.info`/`logger.warning` strings with no request ID,
so tracing a single enrollment or attendance-mark call through the logs during an incident is
manual grep-and-pray.
**How:** Add a middleware that generates a `request_id` (uuid4) per request, attach it to the
logging context (e.g. `contextvars` + a custom `Formatter`), and include it in every log line
in `azure_face.py` and the routers. Switch to JSON log output if you ever centralize logs
(ELK/CloudWatch/Datadog).
**Effort:** M

---

## Phase 2 — Medium severity, Medium/Large effort

### 10. Stand up CI (if not already present)
**Why:** No `.github/workflows` visible in the repo — no automated test run, lint, or scan
happens today. Everything (#8, frontend `npm test`, backend tests) currently depends on a
human remembering to run it locally.
**How:** Add a GitHub Actions workflow: `npm run lint && npm test` for frontend, `pytest`
(once backend tests exist — see #11) + `pip-audit` for backend, on every push/PR.
**Effort:** S–M

### 11. Add backend tests
**Why:** There's a frontend Vitest setup (`src/test/`) but no visible backend test suite.
The face-matching threshold logic (`_cosine_similarity`, `_check_face_quality`,
`check_duplicate_face`) is exactly the kind of pure-ish logic that's cheap to unit-test and
easy to silently break during refactors.
**How:** `pytest` + `pytest-asyncio`, mock `_get_insight_app()`/`_get_col()` so tests don't
need a real MongoDB or the 300MB model. Cover: duplicate-detection threshold edge cases,
quality-check rejections, the `already_marked` idempotency path in `mark_attendance`.
**Effort:** M

### 12. Observability: metrics on the expensive path
**Why:** InsightFace inference is the performance-critical, resource-heavy part of this
system, and it currently has zero timing/metrics instrumentation. You won't know if
enrollment/identify latency creeps up until users complain.
**How:** Wrap `_encode_all`, `_identify`, and `_check` in simple timing logs first
(`time.perf_counter()` before/after), then graduate to Prometheus via
`prometheus-fastapi-instrumentator` if you deploy somewhere that scrapes metrics. Track: faces
detected per request, inference duration, match confidence distribution.
**Effort:** M

### 13. Database performance safeguards
**Why:** `_load_all()` in `azure_face.py` pulls **every** enrolled person's embeddings into
memory on every single identify/duplicate-check call. Fine at 50 people, will not scale to
5,000.
**How:** For now (small scale) this is acceptable — flag it as a known limitation. When it
becomes a bottleneck: cache the embedding matrix in memory with invalidation on
enroll/delete, or move to a vector index (MongoDB Atlas Vector Search, or FAISS) instead of
brute-force cosine similarity in Python.
**Effort:** L (defer until you actually see scale)

---

## Phase 3 — Lower priority / long-term

### 14. Role-based access once auth exists
Once #1 lands, split permissions: "operator" can mark attendance and create sessions;
"admin" can enroll/delete persons and export data. Prevents an operator's leaked API key
from allowing wholesale data deletion.

### 15. Disaster recovery basics
- Confirm MongoDB Atlas has automated backups enabled (it does by default on paid tiers —
  verify on the free tier, which may not).
- Document a recovery runbook: what happens if `face_encodings` collection is lost —
  answer today would be "everyone must re-enroll," which is worth knowing before it happens.

### 16. Security headers / CORS tightening
`ALLOWED_ORIGINS` defaults are reasonable, but double check no wildcard (`*`) origin ever
ends up in `allow_origins` in production, since `allow_credentials=True` + wildcard origin is
a real CORS vulnerability combination.

---

## Suggested order of execution

| Order | Item | Severity | Effort |
|---|---|---|---|
| 1 | Auth on mutating endpoints (#1) | High | S–M |
| 2 | Fix `debug-azure`, `ObjectId` crashes, README (#2–4) | Med/High | S |
| 3 | Rate limiting (#5) | High | S |
| 4 | Secrets hygiene + rotation (#6) | High | S–M |
| 5 | Upload validation (#7) | Medium | S |
| 6 | Dependency scanning + CI (#8, #10) | Medium | S–M |
| 7 | Logging/request IDs (#9) | Medium | M |
| 8 | Backend tests (#11) | Medium | M |
| 9 | Metrics on inference path (#12) | Medium | M |
| 10 | Embedding-store scaling (#13) | Low (for now) | L |
| 11 | RBAC, DR runbook, CORS audit (#14–16) | Low | S–M |

This gets you from "no auth, stale docs, silent 500s" to "authenticated, rate-limited,
CI-scanned, observable" in roughly the order that reduces the most real-world risk per hour
spent.
