# Smart Attendance System — Backend

FastAPI backend for the Smart Attendance System.  
Integrates **Microsoft Azure Face API** + **Azure Blob Storage** + **SQLite/PostgreSQL**.

---

## Project Structure

```
backend/
├── main.py                   ← FastAPI app, CORS, router registration
├── core/
│   ├── azure_face.py         ← Azure Face API + Blob Storage wrapper
│   ├── database.py           ← SQLAlchemy async models + DB helpers
│   └── schemas.py            ← Pydantic request/response schemas
├── routers/
│   ├── dashboard.py          ← GET /api/dashboard/metrics & /activity
│   ├── persons.py            ← CRUD + Azure enrollment
│   ├── sessions.py           ← Session create / list / end
│   ├── attendance.py         ← Identify faces + mark attendance + export
│   └── reports.py            ← Daily stats, per-person rates, heatmap
├── frontend_api_service.ts   ← Drop into src/services/api.ts in the React app
├── requirements.txt
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
```

### 2. Configure environment

```bash
cp .env.example .env
# Open .env and fill in your Azure keys
```

### 3. Run the server

```bash
uvicorn main:app --reload --port 8000
```

API docs available at: **http://localhost:8000/docs**

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/metrics` | Total enrolled, sessions today, present today, rate |
| GET | `/api/dashboard/activity` | Latest 8 attendance events |
| GET | `/api/persons` | List all enrolled persons |
| POST | `/api/persons/enroll` | Enroll new person (multipart: name, email, dept, photos) |
| GET | `/api/persons/{id}` | Get one person |
| DELETE | `/api/persons/{id}` | Soft-delete person + remove from Azure |
| GET | `/api/sessions` | List sessions (`?active=true`) |
| POST | `/api/sessions` | Create a new session |
| PATCH | `/api/sessions/{id}/end` | Close an active session |
| POST | `/api/attendance/identify` | Identify faces in frame (no DB write) |
| POST | `/api/attendance/mark/{session_id}` | Identify + mark attendance |
| GET | `/api/attendance` | List records (filterable by date/session/person) |
| GET | `/api/attendance/export/csv` | Download records as CSV |
| GET | `/api/reports/daily` | Daily attendance rate (line chart data) |
| GET | `/api/reports/persons` | Per-person attendance + defaulters list |
| GET | `/api/reports/heatmap` | Person × date matrix for heatmap |

---

## Connecting the Frontend

1. Copy `frontend_api_service.ts` → `src/services/api.ts` in the React project.
2. Add to the React project's `.env`:
   ```
   VITE_API_URL=http://localhost:8000
   ```
3. Import and use in any page:
   ```tsx
   import { dashboardApi, attendanceApi, personsApi } from "@/services/api";

   // Example — Dashboard page
   const metrics = await dashboardApi.getMetrics();

   // Example — Enroll page
   const fd = new FormData();
   fd.append("name", "Jashanpreet Singh");
   fd.append("department", "IT");
   photos.forEach(f => fd.append("photos", f));
   const person = await personsApi.enroll(fd);

   // Example — Live Attendance
   const result = await attendanceApi.mark(sessionId, frameBlob, 0.82);
   ```

---

## Azure Setup Guide

### Step 1 — Create Face API resource
1. Go to [portal.azure.com](https://portal.azure.com)
2. Create resource → **Face** (Cognitive Services)
3. Copy **Key 1** and **Endpoint** into `.env`

### Step 2 — Create Storage Account
1. Create resource → **Storage Account**
2. Copy the **Connection String** from Access Keys into `.env`
3. A container named `attendance-photos` will be auto-created on first run

### Step 3 — Initialize PersonGroup
The PersonGroup is created automatically on the first `/api/persons/enroll` call.  
Or manually trigger it via the `/docs` interactive API explorer.

---

## Database

- **Development**: SQLite (`attendance.db`) — zero config, auto-created on startup
- **Production**: Switch to PostgreSQL by updating `DATABASE_URL` in `.env`:
  ```
  DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname
  ```

---

## Deployment

### Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t attendance-backend .
docker run -p 8000:8000 --env-file .env attendance-backend
```

### Azure App Service
1. Push Docker image to Azure Container Registry
2. Create App Service → Docker container
3. Set all `.env` values in App Service → Configuration → Application Settings
