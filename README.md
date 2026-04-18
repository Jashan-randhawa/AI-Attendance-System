# 🎓 Smart Attend — AI-Powered Attendance System

> Face-recognition attendance tracking built with **InsightFace**, **MongoDB Atlas**, **Azure Blob Storage**, **FastAPI**, and **React + TypeScript**.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Frontend Pages](#frontend-pages)
- [Database Schema](#database-schema)
- [Face Recognition Pipeline](#face-recognition-pipeline)
- [Deployment](#deployment)
  - [Docker](#docker)
  - [Render](#render)
  - [Azure App Service](#azure-app-service)
- [Configuration Tuning](#configuration-tuning)
- [Troubleshooting](#troubleshooting)

---

## Overview

**Smart Attend** is a full-stack, AI-powered attendance system that replaces manual roll calls with automated face recognition. A session organiser uploads or streams a photo of a group; the system detects all faces, matches them against enrolled persons stored in MongoDB, and records attendance — all in a single API call.

Key capabilities:

- Enroll persons with 1–10 reference photos
- Mark attendance from any image (webcam frame, uploaded photo)
- Prevent duplicate records per person per session
- Generate daily/per-person reports and heatmaps
- Export attendance as CSV
- Soft-delete persons without losing historical records

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│   React + Vite + Tailwind + shadcn/ui + React Query     │
│   Pages: Dashboard · Live · Enroll · Records · Reports  │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP / REST
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   FastAPI Backend                        │
│                                                         │
│   /api/dashboard  →  dashboard.py                       │
│   /api/persons    →  persons.py    ──► InsightFace       │
│   /api/sessions   →  sessions.py                        │
│   /api/attendance →  attendance.py ──► InsightFace       │
│   /api/reports    →  reports.py                         │
│                                                         │
│   core/azure_face.py  (InsightFace wrapper)             │
│   core/database.py    (Motor async MongoDB)             │
│   core/schemas.py     (Pydantic v2 models)              │
└──────────┬──────────────────────┬───────────────────────┘
           │                      │
           ▼                      ▼
  MongoDB Atlas            Azure Blob Storage
  (persons,                (enrollment photos
   sessions,                stored per person)
   attendance,
   face_encodings)
```

---

## Project Structure

```
AI-Attendance-System-main/
│
├── backend/
│   ├── main.py                    # FastAPI app entrypoint, CORS, router registration
│   ├── Dockerfile                 # Production Docker image (python:3.11-slim)
│   ├── requirements.txt           # Python dependencies
│   ├── .env.example               # All required environment variables
│   ├── sitecustomize.py           # Python startup customisation
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── azure_face.py          # InsightFace model + MongoDB face store wrapper
│   │   ├── database.py            # Motor async client, index creation, DB helpers
│   │   └── schemas.py             # Pydantic v2 request/response schemas
│   │
│   └── routers/
│       ├── __init__.py
│       ├── dashboard.py           # GET /api/dashboard/metrics & /activity
│       ├── persons.py             # CRUD + InsightFace enrollment
│       ├── sessions.py            # Session lifecycle (create / list / end)
│       ├── attendance.py          # Identify faces + mark attendance + CSV export
│       └── reports.py             # Daily stats, per-person rates, heatmap
│
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── tsconfig.json
    ├── package.json
    ├── vercel.json                # SPA routing config for Vercel
    ├── .env.example
    │
    └── src/
        ├── App.tsx                # Route definitions (react-router-dom v6)
        ├── main.tsx               # React root
        ├── index.css              # Global styles
        │
        ├── services/
        │   └── api.ts             # Centralised typed API client (all fetch calls)
        │
        ├── pages/
        │   ├── Index.tsx          # Dashboard — metrics + recent activity
        │   ├── LiveAttendance.tsx # Camera/upload → identify → mark
        │   ├── EnrollPerson.tsx   # Multi-photo enrollment form
        │   ├── Records.tsx        # Filterable attendance records table
        │   ├── Reports.tsx        # Charts: daily trend, per-person, defaulters
        │   └── NotFound.tsx       # 404 page
        │
        ├── components/
        │   ├── AppLayout.tsx      # Shell with sidebar + main content area
        │   ├── AppSidebar.tsx     # Responsive navigation sidebar (hamburger on mobile)
        │   ├── MetricCard.tsx     # Dashboard KPI card
        │   ├── NavLink.tsx        # Active-aware navigation link
        │   └── ui/                # shadcn/ui component library (40+ components)
        │
        ├── hooks/
        │   ├── use-mobile.tsx     # Breakpoint hook (md = 768 px)
        │   └── use-toast.ts       # Toast notification hook
        │
        └── lib/
            └── utils.ts           # Tailwind `cn()` helper
```

---

## Tech Stack

### Backend

| Layer | Technology |
|---|---|
| Framework | FastAPI 0.115+ |
| Face Recognition | InsightFace (`buffalo_sc` model) + ONNX Runtime |
| Image Processing | OpenCV headless (CLAHE preprocessing), Pillow |
| Database | MongoDB Atlas via Motor (async) |
| File Storage | Azure Blob Storage |
| Validation | Pydantic v2 |
| Server | Uvicorn (ASGI) |
| Containerisation | Docker (python:3.11-slim) |

### Frontend

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite 5 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 + shadcn/ui |
| Routing | React Router v6 |
| Data Fetching | TanStack React Query v5 |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Notifications | Sonner |

---

## Features

### Face Enrollment
- Upload 1–10 reference photos per person
- CLAHE preprocessing for varied lighting conditions
- 512-dimensional face embedding stored in MongoDB (`face_encodings` collection)
- Duplicate detection: rejects enrollment if similarity > `DUPLICATE_THRESHOLD` (default 0.45)
- Photos stored in Azure Blob Storage, URL saved to person record
- Supports `name`, `email`, `department` metadata

### Live Attendance
- Submit a webcam frame or uploaded image to `/api/attendance/mark/{session_id}`
- InsightFace detects all faces in the image simultaneously
- Each detected face embedding is compared against all enrolled embeddings
- Attendance record created only if confidence ≥ `MIN_CONFIDENCE` (default 0.40)
- Compound unique index prevents double-marking per (person, session) pair
- Response includes bounding boxes for UI overlay

### Session Management
- Create named sessions with optional department filter
- List active or all sessions
- End sessions with a timestamp
- Attendance records are always scoped to a session

### Reports & Analytics
- **Daily trend**: line chart of attendance rate over the last N days
- **Per-person stats**: total sessions attended, attendance rate, defaulter flag (<75%)
- **Heatmap**: person × date attendance matrix
- **CSV export**: download all records, filterable by session or date

### Dashboard
- Total enrolled persons
- Sessions created today
- Persons marked present today
- Overall attendance rate (percentage)
- Latest 8 attendance events with name, department, session, and confidence

---

## Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.11+ |
| Node.js / npm | 18+ / 9+ |
| MongoDB Atlas | Free tier sufficient |
| Azure Storage Account | For photo storage |
| Git | Any recent version |

> **Note:** InsightFace requires a C++ compiler at install time. The Dockerfile handles this automatically with `apt-get install g++`.

---

## Getting Started

### Backend Setup

```bash
# 1. Enter the backend directory
cd backend

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 3. Install Python dependencies
pip install -r requirements.txt
# Note: InsightFace compiles a Cython extension — this takes ~2-3 minutes on first install

# 4. Configure environment variables
cp .env.example .env
# Open .env and fill in your keys (see Environment Variables section)

# 5. Start the development server
uvicorn main:app --reload --port 8000
```

The API will be available at **http://localhost:8000**  
Interactive docs (Swagger UI): **http://localhost:8000/docs**  
ReDoc: **http://localhost:8000/redoc**

On first startup, the backend will:
1. Connect to MongoDB Atlas and verify the connection
2. Create all required indexes (persons, sessions, attendance)
3. Pre-warm the InsightFace `buffalo_sc` model in a background executor (~10-60 seconds on first run — the model (~300 MB) is downloaded automatically)

---

### Frontend Setup

```bash
# 1. Enter the frontend directory
cd frontend

# 2. Configure environment variables
cp .env.example .env
# Edit .env: set VITE_API_URL=http://localhost:8000

# 3. Install Node dependencies
npm install

# 4. Start the development server
npm run dev
```

The app will be available at **http://localhost:5173**

Other npm scripts:

| Command | Description |
|---|---|
| `npm run build` | Production build (outputs to `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest unit tests |
| `npm run test:watch` | Run Vitest in watch mode |

---

## Environment Variables

### Backend (`backend/.env`)

```env
# ── Microsoft Azure Blob Storage ──────────────────────────────────────────────
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...
AZURE_BLOB_CONTAINER=attendance-photos          # Auto-created on first enroll

# ── MongoDB Atlas ─────────────────────────────────────────────────────────────
MONGODB_URL=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=attendance_db                   # Default: attendance_db

# ── Face Recognition Settings ─────────────────────────────────────────────────
PERSON_GROUP_ID=attendance-group                # Logical group label (unused in InsightFace, kept for legacy)
MIN_CONFIDENCE=0.40                             # Minimum cosine similarity to accept a match (0.1–1.0)
DUPLICATE_THRESHOLD=0.45                        # Similarity above which a new enrollment is rejected as duplicate

# ── App Settings ──────────────────────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app
```

**Confidence thresholds explained:**

| Variable | Default | Effect |
|---|---|---|
| `MIN_CONFIDENCE` | `0.40` | Lower = more lenient recognition (more false positives). Raise to `0.60`+ for high-security environments. |
| `DUPLICATE_THRESHOLD` | `0.45` | Must be ≥ `MIN_CONFIDENCE`. Lower = stricter duplicate detection. |

### Frontend (`frontend/.env`)

```env
# URL of the running FastAPI backend
VITE_API_URL=http://localhost:8000
# Production example:
# VITE_API_URL=https://your-backend.onrender.com
```

---

## API Reference

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/` | Returns `{"status": "ok"}` |
| GET | `/health` | Returns `{"status": "healthy"}` |

### Dashboard

| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard/metrics` | `{ total_enrolled, sessions_today, present_today, attendance_rate }` |
| GET | `/api/dashboard/activity` | Latest 8 attendance events |

### Persons

| Method | Path | Description |
|---|---|---|
| GET | `/api/persons` | List all active enrolled persons |
| GET | `/api/persons/{id}` | Get a single person by ID |
| POST | `/api/persons/enroll` | Enroll new person — `multipart/form-data`: `name`, `email?`, `department?`, `photos[]` |
| DELETE | `/api/persons/{id}` | Soft-delete person (keeps attendance history) |
| GET | `/api/persons/debug-encodings` | Diagnostic: persons in DB without face encodings |
| GET | `/api/persons/debug-azure` | Diagnostic: validate Azure/MongoDB config |

**Enroll example (curl):**
```bash
curl -X POST http://localhost:8000/api/persons/enroll \
  -F "name=Jashan Singh" \
  -F "department=Engineering" \
  -F "email=jashan@example.com" \
  -F "photos=@photo1.jpg" \
  -F "photos=@photo2.jpg"
```

### Sessions

| Method | Path | Description |
|---|---|---|
| GET | `/api/sessions` | List sessions. Query: `?active=true` for active only |
| POST | `/api/sessions` | Create session — `{ "label": "CS101 Lecture", "department": "CS" }` |
| PATCH | `/api/sessions/{id}/end` | End an active session (sets `ended_at`, `is_active: false`) |

### Attendance

| Method | Path | Description |
|---|---|---|
| POST | `/api/attendance/identify` | Identify faces in a frame (no DB write). Query: `?confidence=0.4` |
| POST | `/api/attendance/mark/{session_id}` | Identify faces + write attendance records |
| GET | `/api/attendance` | List records. Query: `?session_id=`, `?person_id=`, `?date=YYYY-MM-DD`, `?status=present` |
| GET | `/api/attendance/export/csv` | Download CSV. Query: `?session_id=`, `?date=YYYY-MM-DD` |

**Mark attendance example (curl):**
```bash
curl -X POST "http://localhost:8000/api/attendance/mark/SESSION_ID?confidence=0.45" \
  -F "frame=@webcam_frame.jpg"
```

**Response:**
```json
{
  "session_id": "664abc123...",
  "identified": [
    {
      "azure_person_id": "uuid-...",
      "name": "Jashan Singh",
      "confidence": 0.87,
      "face_box": { "top": 120, "left": 80, "width": 200, "height": 200 },
      "already_marked": false
    }
  ],
  "new_records": 1
}
```

### Reports

| Method | Path | Description |
|---|---|---|
| GET | `/api/reports/daily` | Daily attendance rate. Query: `?days=30` |
| GET | `/api/reports/persons` | Per-person stats + defaulters list. Query: `?days=30` |
| GET | `/api/reports/heatmap` | Person × date matrix. Query: `?days=14` |

---

## Frontend Pages

### `/` — Dashboard
Displays four KPI metric cards (total enrolled, sessions today, present today, attendance rate) and a live activity feed showing the most recent 8 attendance events with person name, department, session, confidence score, and timestamp.

### `/live-attendance` — Live Attendance
Allows the user to:
1. Select or create an active session
2. Upload a camera frame or image file
3. View identified faces with bounding boxes and confidence scores
4. Mark attendance for the current session

### `/enroll` — Enroll Person
Multi-step form to register a new person. Fields: name (required), email, department. Photo upload accepts up to 10 images via drag-and-drop or file picker. Displays a preview grid and submits as `multipart/form-data`.

### `/records` — Attendance Records
Searchable, sortable table of all attendance records with filters for date, session, person, and status. Includes a **Download CSV** button that triggers the export endpoint.

### `/reports` — Analytics Reports
Three visualisations rendered with Recharts:
- **Daily Attendance Trend** — line chart over last 30 days
- **Per-Person Attendance Rate** — bar chart sorted by rate, red bars for defaulters (<75%)
- **Attendance Heatmap** — calendar grid (person × date) for the last 14 days

---

## Database Schema

MongoDB collections with their key fields:

### `persons`
```json
{
  "_id": "uuid-string",           // InsightFace-generated UUID
  "name": "Jashan Singh",
  "email": "jashan@example.com",
  "department": "Engineering",
  "photo_url": "https://blob.core.windows.net/...",
  "enrolled_at": "2025-04-11T10:00:00",
  "is_active": true
}
```

### `face_encodings`
```json
{
  "_id": "uuid-string",           // Same as persons._id
  "encoding": [0.12, -0.34, ...]  // 512-dim float array
}
```

### `sessions`
```json
{
  "_id": "ObjectId",
  "label": "CS101 Lecture — Week 3",
  "department": "CS",
  "started_at": "2025-04-11T09:00:00",
  "ended_at": null,
  "is_active": true
}
```

### `attendance`
```json
{
  "_id": "ObjectId",
  "person_id": "uuid-string",     // FK → persons._id
  "session_id": "ObjectId-string",// FK → sessions._id (stored as string)
  "marked_at": "2025-04-11T09:05:32",
  "confidence": 0.87,
  "status": "present"
}
```

**Indexes:**
- `attendance`: compound unique on `(person_id, session_id)` → prevents double-marking
- `persons`: case-insensitive unique on `name` (active persons only, partial index)
- `sessions`: on `(is_active)` and `(started_at DESC)`
- `attendance`: on `(marked_at DESC)` and `(status)`

---

## Face Recognition Pipeline

```
Enrollment                              Identification
──────────                              ──────────────
Upload photos (1–10)                    Submit frame image
       │                                       │
       ▼                                       ▼
CLAHE preprocessing              CLAHE preprocessing
(equalise contrast)              (equalise contrast)
       │                                       │
       ▼                                       ▼
InsightFace detect faces         InsightFace detect all faces
       │                                       │
       ▼                                       ▼
Extract 512-dim embedding        Extract 512-dim embeddings
       │                                       │
       ▼                                       ▼
Average across all photos        For each detected face:
       │                           cosine_similarity(face, all enrolled)
       ▼                                       │
Duplicate check:                 Pick best match
  similarity > DUPLICATE_THRESHOLD?    │
  → reject with 409              confidence ≥ MIN_CONFIDENCE?
       │                           → IdentifyResult
       ▼                           → upsert attendance record
Store encoding in MongoDB
Store photo in Azure Blob
Save person in MongoDB
```

---

## Deployment

### Docker

```bash
# Build the image (InsightFace model is downloaded and cached at build time)
docker build -t attendance-backend ./backend

# Run the container
docker run -p 8000:8000 \
  --env-file ./backend/.env \
  attendance-backend
```

The Dockerfile pre-downloads the `buffalo_sc` model at build time, so container cold starts are fast (~2–3 seconds instead of 60+ seconds).

### Render

1. **Backend** — Deploy as a **Web Service**:
   - Runtime: Docker (uses the `backend/Dockerfile`)
   - Set all backend env vars in Render → Environment tab
   - Health check path: `/health`

2. **Frontend** — Deploy as a **Static Site**:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Set `VITE_API_URL` to the backend's Render URL

### Azure App Service

```bash
# 1. Build and push to Azure Container Registry
az acr build --registry <your-acr> --image attendance-backend:latest ./backend

# 2. Create App Service (Linux, Docker)
az webapp create \
  --resource-group <rg> \
  --plan <plan> \
  --name attendance-backend \
  --deployment-container-image-name <your-acr>.azurecr.io/attendance-backend:latest

# 3. Set environment variables
az webapp config appsettings set \
  --name attendance-backend \
  --resource-group <rg> \
  --settings MONGODB_URL="..." AZURE_STORAGE_CONNECTION_STRING="..."
```

### Vercel (Frontend Only)

The `frontend/vercel.json` includes SPA routing rewrites. Deploy directly from the `frontend/` directory:
```bash
cd frontend
vercel --prod
```

---

## Configuration Tuning

| Scenario | Recommendation |
|---|---|
| High-security environment | Set `MIN_CONFIDENCE=0.65`, `DUPLICATE_THRESHOLD=0.55` |
| Dim lighting / poor cameras | Set `MIN_CONFIDENCE=0.35` and ensure CLAHE is active |
| Many similar-looking people | Lower `DUPLICATE_THRESHOLD=0.40` |
| Large group photos | Use high-resolution images; detection works best at face width ≥ 80px |
| Slow cold starts | Use Docker (model pre-baked) or increase Render plan memory |

---

## Troubleshooting

### `InsightFace model not found` on startup
The `buffalo_sc` model (~300 MB) is downloaded to `~/.insightface/models/` on first run. Ensure network access or use the Docker image (model baked in).

### `MONGODB_URL not set — using localhost`
The backend falls back to `mongodb://localhost:27017`. Set `MONGODB_URL` in your `.env`.

### Person not recognised despite being enrolled
Run `GET /api/persons/debug-encodings` — if the person appears in the `missing` list, their face encoding was not saved correctly. Delete and re-enroll with clearer photos (good lighting, face centred, no occlusion).

### `409 Duplicate person detected` on enrollment
The new photos are too similar to an existing person (similarity > `DUPLICATE_THRESHOLD`). Either delete the existing person first, or raise the threshold in `.env`.

### CORS errors in the browser
Add your frontend's URL to `ALLOWED_ORIGINS` in `backend/.env`:
```env
ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app
```

### `Azure Blob Storage` container not found
The container named `attendance-photos` is created automatically on the first enrollment call. Ensure the `AZURE_STORAGE_CONNECTION_STRING` is correct and the storage account exists.

---

## License

This project is for educational and portfolio purposes.

---

*Generated from source analysis of AI-Attendance-System-main — April 2026*
