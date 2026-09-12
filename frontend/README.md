# Smart Attendance System — Integrated Project

A face-recognition attendance system with a **FastAPI backend** (Azure Face API) and a **React + Vite frontend**.

## Project Structure

```
├── backend/          # FastAPI Python backend
│   ├── main.py
│   ├── core/         # DB, schemas, Azure integration
│   ├── routers/      # API routes (persons, sessions, attendance, reports, dashboard)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── src/              # React frontend (Vite + Tailwind + shadcn/ui)
│   ├── pages/        # Dashboard, LiveAttendance, EnrollPerson, Records, Reports
│   ├── services/api.ts   # Centralised API client (connects to backend)
│   └── components/
├── .env.example      # Frontend env vars
└── package.json
```

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env        # Fill in Azure keys + DB URL
pip install -r requirements.txt
uvicorn main:app --reload   # Runs on http://localhost:8000
```

### 2. Frontend

```bash
cp .env.example .env        # Set VITE_API_URL=http://localhost:8000
npm install
npm run dev                 # Runs on http://localhost:5173
```

## Environment Variables

| Variable | Location | Description |
|---|---|---|
| `AZURE_FACE_KEY` | backend/.env | Azure Face API key |
| `AZURE_FACE_ENDPOINT` | backend/.env | Azure Face API endpoint |
| `AZURE_STORAGE_CONNECTION_STRING` | backend/.env | Azure Blob Storage |
| `DATABASE_URL` | backend/.env | SQLite (dev) or PostgreSQL (prod) |
| `VITE_API_URL` | .env | Backend URL for the frontend |

## API Endpoints

- `GET /api/dashboard/metrics` — today's summary stats  
- `GET /api/dashboard/activity` — recent attendance activity  
- `POST /api/persons/enroll` — enroll a new person (multipart/form-data)  
- `GET /api/sessions` — list sessions  
- `POST /api/sessions` — create a session  
- `POST /api/attendance/mark/{session_id}` — identify faces & mark attendance  
- `GET /api/attendance` — list all records  
- `GET /api/attendance/export/csv` — download CSV  
- `GET /api/reports/daily` — daily attendance stats  
- `GET /api/reports/persons` — per-person stats + defaulters  
