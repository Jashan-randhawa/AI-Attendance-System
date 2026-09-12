# Smart Attendance System — Backend Service

FastAPI backend microservice for automated facial attendance tracking.
Powered by **InsightFace** (local ONNX neural inference), **MongoDB Atlas** (via asynchronous Motor driver), and optional **Azure Blob Storage** photo hosting.

---

## Technical Highlights

- **Unified Async Engine**: Single consolidated `Motor` client for all collections (`users`, `persons`, `sessions`, `attendance`, `face_encodings`).
- **Per-User JWT Authentication & RBAC**: Strict role enforcement (`operator` vs `admin`) with signed Bearer JWTs, salted `scrypt` password hashing, and backward-compatible `X-API-Key` fallback.
- **Biometric Integrity**: Compensating rollback deletes face embeddings if database person insertion fails during enrollment.
- **Idempotent Mark Operations**: Compound unique indexes over `(person_id, session_id)` with native `ObjectId` storage.
- **Image Safeguards**: Dual-layer upload validation capping file size at 10 MB and decoded pixel dimensions at 6000×6000 px.
- **Comprehensive Observability**: Automatic `X-Request-ID` correlation across async and executor thread logs, plus structured inference latency metrics.

---

## Directory Layout

```
backend/
├── main.py                     # FastAPI application, CORS guard, route registration, lifespan
├── requirements.txt            # Production dependencies (FastAPI, Motor, InsightFace, PyJWT)
├── requirements-dev.txt        # Development and testing dependencies (pytest, pytest-asyncio)
├── Dockerfile                  # Multi-stage production container with pre-baked model weights
├── pytest.ini                  # Pytest configuration
├── .env.example                # Environment variable reference
│
├── core/
│   ├── auth.py                 # JWT issuance, scrypt hashing, require_operator & require_admin
│   ├── azure_face.py           # InsightFace pipeline, quality gates, async encodings persistence
│   ├── database.py             # Motor async database client, indexes, and queries
│   ├── logging_context.py      # Request-ID tracking & thread executor context propagation
│   ├── rate_limit.py           # SlowAPI Limiter instance
│   ├── schemas.py              # Pydantic v2 schemas and models
│   └── validation.py           # Image decode verification and dimension limits
│
├── routers/
│   ├── auth.py                 # /api/auth (login, register, me)
│   ├── attendance.py           # /api/attendance (identify, mark, list, CSV export)
│   ├── persons.py              # /api/persons (enroll with rollback, list, get, delete, debug)
│   ├── sessions.py             # /api/sessions (create, list, get, end)
│   ├── dashboard.py            # /api/dashboard (metrics, activity)
│   └── reports.py              # /api/reports (daily stats, per-person rates, heatmap)
│
├── scripts/
│   ├── create_user.py          # Account provisioning CLI
│   └── migrate_session_id_to_objectid.py # Migration tool for legacy string session IDs
│
└── tests/                      # 63 unit and integration tests (zero GPU / cloud DB needed)
```

---

## Quick Start

### 1. Environment Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt -r requirements-dev.txt
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Ensure the following variables are configured in `.env`:
- `JWT_SECRET`: Secret key for JWT signing (minimum 32 characters in production).
- `MONGODB_URL`: Connection string for your MongoDB Atlas cluster.
- `API_KEY_ADMIN` & `API_KEY_OPERATOR`: *(Optional)* Shared secrets for fallback authorization.

### 3. Provision Admin Account

```bash
python scripts/create_user.py --username admin --password "YourSecretPassword123" --role admin
```

*(Optional)* If upgrading an existing database with legacy string `session_id` fields in `attendance`:
```bash
python scripts/migrate_session_id_to_objectid.py --verify
```

### 4. Run Server

```bash
uvicorn main:app --reload --port 8000
```

- **Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## API Endpoints & Access Control Matrix

| Method | Path | Minimum Role | Description |
|---|---|---|---|
| **GET** | `/` , `/health` | Public | Health checks |
| **POST**| `/api/auth/login` | Public | Authenticate user credentials and return signed JWT |
| **POST**| `/api/auth/register` | Admin | Create user accounts |
| **GET** | `/api/auth/me` | Operator | Retrieve authenticated profile |
| **GET** | `/api/dashboard/metrics` | Operator | Aggregate dashboard statistics |
| **GET** | `/api/dashboard/activity` | Operator | Feed of recent attendance events |
| **GET** | `/api/sessions` | Operator | List attendance sessions |
| **GET** | `/api/sessions/{id}` | Operator | Fetch session details |
| **POST**| `/api/sessions` | Operator | Create a new attendance session |
| **PATCH**| `/api/sessions/{id}/end` | Operator | Conclude an active session |
| **POST**| `/api/attendance/identify` | Operator | Run facial identification on frame (read-only) |
| **POST**| `/api/attendance/mark/{session_id}` | Operator | Identify and mark attendance (idempotent) |
| **GET** | `/api/attendance` | Operator | List attendance records |
| **GET** | `/api/attendance/export/csv` | Admin | Stream attendance data as CSV |
| **GET** | `/api/persons` | Admin | List enrolled persons |
| **GET** | `/api/persons/{id}` | Admin | Get person profile |
| **POST**| `/api/persons/enroll` | Admin | Enroll new person with multi-photo analysis & rollback |
| **DELETE**| `/api/persons/{id}` | Admin | Soft-delete person |
| **GET** | `/api/persons/debug-encodings` | Admin | Audit missing face encodings |
| **GET** | `/api/reports/daily` | Admin | Daily attendance trends |
| **GET** | `/api/reports/persons` | Admin | Per-person attendance metrics and defaulters |
| **GET** | `/api/reports/heatmap` | Admin | Presence calendar heatmap |

---

## Rate Limiting

Inference endpoints are protected by IP-based rate limiting via SlowAPI:
- `POST /api/persons/enroll`: 10 requests / minute
- `POST /api/attendance/identify`: 20 requests / minute
- `POST /api/attendance/mark/{session_id}`: 20 requests / minute

---

## Running Automated Tests

The test suite runs completely offline with mocked fixtures:

```bash
pytest -v
```

Tests verify:
- Security dependencies (operator vs admin role gating, legacy fallback).
- JWT token lifecycle and salted scrypt verification.
- Idempotency in attendance marking and duplicate key handling.
- Face matching math (cosine similarity boundary conditions).
- Compensating transaction rollback on database insertion faults.
- Image byte and pixel dimension limits (rejection of >6000px images).
