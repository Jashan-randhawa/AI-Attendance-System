# 🎯 AI Attendance System

> AI-powered attendance tracking using **InsightFace** face recognition, **MongoDB Atlas**, and **Azure Blob Storage** — with a live React dashboard.

🌐 **Live Demo:** [ai-attendance-system-mauve.vercel.app](https://ai-attendance-system-mauve.vercel.app)

---

## ✨ Features

- **Real-time Face Recognition** — Identify multiple faces in a single camera frame using InsightFace (ONNX-based, runs on CPU)
- **Live Attendance Marking** — Capture a frame, identify attendees, and mark records in one click
- **Person Enrollment** — Register individuals with multiple photos for higher accuracy
- **Session Management** — Create and manage named attendance sessions per department
- **Dashboard** — Live metrics: total enrolled, sessions today, present count, attendance rate, and a weekly bar chart
- **Records & Filtering** — Browse attendance history filtered by date, session, person, or department
- **Reports** — Daily attendance rate trends, per-person attendance breakdown, and an attendance heatmap
- **CSV Export** — Download filtered attendance records as a CSV file
- **Duplicate Detection** — Cosine-similarity check prevents re-enrolling the same person twice
- **Photo Storage** — Enrollment photos stored in Azure Blob Storage
- **CORS-ready** — Pre-configured for local dev and the Vercel deployment

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, TailwindCSS, shadcn/ui, Recharts |
| **Backend** | Python 3.11, FastAPI, Uvicorn |
| **Face Recognition** | InsightFace (buffalo_l model), ONNX Runtime, OpenCV |
| **Database** | MongoDB Atlas (async via Motor) |
| **Photo Storage** | Azure Blob Storage |
| **Deployment** | Vercel (frontend), Docker / Render (backend) |

---

## 📁 Project Structure

```
AI-Attendance-System/
├── frontend/                      # React + Vite app
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Index.tsx          # Dashboard
│   │   │   ├── LiveAttendance.tsx # Camera + face marking
│   │   │   ├── EnrollPerson.tsx   # Register new persons
│   │   │   ├── Records.tsx        # Attendance history table
│   │   │   └── Reports.tsx        # Charts & heatmap
│   │   ├── services/
│   │   │   └── api.ts             # Centralised API client
│   │   └── components/            # UI components (shadcn/ui)
│   ├── .env.example
│   └── package.json
│
└── backend/                       # FastAPI app
    ├── main.py                    # App entry, CORS, router registration
    ├── core/
    │   ├── azure_face.py          # InsightFace + Blob Storage wrapper
    │   ├── database.py            # Motor (async MongoDB) models & helpers
    │   └── schemas.py             # Pydantic request/response schemas
    ├── routers/
    │   ├── dashboard.py           # Metrics & recent activity
    │   ├── persons.py             # CRUD + face enrollment
    │   ├── sessions.py            # Session lifecycle
    │   ├── attendance.py          # Identify faces + mark records + CSV export
    │   └── reports.py             # Daily stats, per-person, heatmap
    ├── requirements.txt
    ├── .env.example
    └── Dockerfile
```

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+ (or Bun)
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (free tier works)
- An [Azure Storage Account](https://portal.azure.com) (for photo uploads)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/AI-Attendance-System.git
cd AI-Attendance-System
```

### 2. Backend setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and fill in your credentials (see Environment Variables section below)

# Start the server
uvicorn main:app --reload --port 8000
```

API docs will be available at **http://localhost:8000/docs**

### 3. Frontend setup

```bash
cd frontend

# Install dependencies
npm install          # or: bun install

# Configure environment variables
cp .env.example .env
# Set VITE_API_URL to your backend URL

# Start the dev server
npm run dev          # or: bun dev
```

Frontend will run at **http://localhost:5173**

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `MONGODB_URL` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster0.xyz.mongodb.net/` |
| `MONGODB_DB_NAME` | Database name | `attendance_db` |
| `AZURE_FACE_KEY` | Azure Face API key (optional, legacy) | `abc123...` |
| `AZURE_FACE_ENDPOINT` | Azure Face API endpoint (optional, legacy) | `https://my-resource.cognitiveservices.azure.com/` |
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Blob Storage connection string | `DefaultEndpointsProtocol=https;...` |
| `AZURE_BLOB_CONTAINER` | Blob container name for photos | `attendance-photos` |
| `PERSON_GROUP_ID` | Face group identifier (lowercase, no spaces) | `attendance-group` |
| `MIN_CONFIDENCE` | Minimum similarity score for recognition | `0.40` |
| `DUPLICATE_THRESHOLD` | Similarity threshold for duplicate detection | `0.45` |
| `ALLOWED_ORIGINS` | Comma-separated frontend URLs for CORS | `http://localhost:5173,https://your-app.vercel.app` |

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend base URL | `http://localhost:8000` |

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard/metrics` | Total enrolled, sessions today, present count, rate |
| `GET` | `/api/dashboard/activity` | Latest 8 attendance events |
| `GET` | `/api/persons` | List all enrolled persons |
| `POST` | `/api/persons/enroll` | Enroll a new person (multipart: name, email, dept, photos) |
| `GET` | `/api/persons/{id}` | Get a single person |
| `DELETE` | `/api/persons/{id}` | Soft-delete person and remove face data |
| `GET` | `/api/sessions` | List sessions (optional `?active=true`) |
| `POST` | `/api/sessions` | Create a new session |
| `PATCH` | `/api/sessions/{id}/end` | Close an active session |
| `POST` | `/api/attendance/identify` | Identify faces in a frame (no DB write) |
| `POST` | `/api/attendance/mark/{session_id}` | Identify faces + mark attendance |
| `GET` | `/api/attendance` | List records (filter by date, session, person) |
| `GET` | `/api/attendance/export/csv` | Download records as CSV |
| `GET` | `/api/reports/daily` | Daily attendance rate data (line chart) |
| `GET` | `/api/reports/persons` | Per-person attendance + defaulters list |
| `GET` | `/api/reports/heatmap` | Person × date attendance matrix |

---

## ☁️ Deployment

### Frontend (Vercel)

1. Push the `frontend/` folder to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Set **Framework Preset** to Vite
4. Add environment variable: `VITE_API_URL=https://your-backend-url`
5. Deploy

### Backend (Docker)

```bash
cd backend
docker build -t attendance-backend .
docker run -p 8000:8000 --env-file .env attendance-backend
```

### Backend (Render)

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect your GitHub repo, set root directory to `backend/`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port 8000`
5. Add all environment variables from `.env.example` in the Render dashboard

### Backend (Azure App Service)

1. Build and push the Docker image to Azure Container Registry
2. Create an App Service with Docker container source
3. Set all `.env` values under App Service → Configuration → Application Settings

---

## 🧠 How Face Recognition Works

1. **Enrollment** — When a person is enrolled, their photos are processed by InsightFace to extract 512-dimensional face embeddings. These embeddings are stored in MongoDB and the photos are uploaded to Azure Blob Storage.

2. **Duplicate Check** — Before saving a new enrollment, the system computes cosine similarity against all existing embeddings. If any match exceeds `DUPLICATE_THRESHOLD`, enrollment is rejected.

3. **Recognition** — During a live attendance session, an uploaded camera frame is passed through InsightFace. Each detected face is compared against all stored embeddings. Matches above `MIN_CONFIDENCE` are identified.

4. **Marking** — Identified persons are marked present in the active session. Already-marked persons are flagged to avoid duplicate records.

---

## 🛠️ Development Notes

- The InsightFace model (`buffalo_l`) is downloaded automatically on first run (~300 MB)
- SQLite is used if `DATABASE_URL` is not set — zero config for local development
- Switch to PostgreSQL for production by setting `DATABASE_URL=postgresql+asyncpg://...`
- All API components import from `src/services/api.ts` — never use `fetch()` directly in components
- The backend pre-warms the InsightFace model and MongoDB connection at startup to reduce first-request latency

---

## 📄 License

MIT — feel free to use and modify.
