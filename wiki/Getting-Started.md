# 🚀 Getting Started with SmartAttend

This guide walks you through setting up and running **SmartAttend** on your local workstation for development, testing, and evaluation.

---

## 📋 Prerequisites

Ensure your system meets the following software requirements:

1. **Python 3.11+** (Python 3.11 or 3.12 recommended for InsightFace ONNX compatibility).
2. **Node.js 18+** & `npm` (For the React 18 frontend and npm workspaces).
3. **MongoDB**:
   - A free cloud cluster on [MongoDB Atlas](https://www.mongodb.com/atlas) (Recommended)
   - Or a local MongoDB instance running at `mongodb://localhost:27017`.
4. **C++ Build Tools / CMake** (Optional, only needed if compiling InsightFace / ONNX from source).

---

## 📥 1. Clone the Repository & Monorepo Setup

```bash
git clone https://github.com/Jashan-randhawa/AI-Attendance-System.git
cd AI-Attendance-System

# Install root npm workspace dependencies:
npm install
```

---

## 📦 2. Test Reusable Modular Packages

SmartAttend uses npm workspaces to manage decoupled packages (`@jashan-randhawa/*`). You can verify all unit tests and run example scripts immediately:

```bash
# Run unit tests across all 5 TypeScript packages:
npm test

# Run the biometric matching & quality gate demo:
node examples/matching-and-quality-demo.js

# Run the client SDK integration demo:
node examples/client-sdk-demo.js
```

---

## 🐍 3. Backend Server Setup (`backend/`)

### Step 1: Create and Activate Virtual Environment

```bash
cd backend

# Windows PowerShell:
python -m venv venv
venv\Scripts\Activate.ps1

# Linux / macOS:
python3 -m venv venv
source venv/bin/activate
```

### Step 2: Install Python Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```
> **Note**: InsightFace will automatically download the lightweight `buffalo_sc` ONNX neural model during its first execution.

### Step 3: Configure Environment Variables

Copy the example environment configuration:
```bash
cp .env.example .env
```

Edit `backend/.env` with your credentials:
```env
# Server & CORS
PORT=8000
HOST=0.0.0.0
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# MongoDB Database Connection
MONGODB_URL=mongodb+srv://<username>:<password>@cluster0.mongodb.net/smartattend?retryWrites=true&w=majority
DATABASE_NAME=smartattend

# Security & Authentication
JWT_SECRET=super_secure_random_jwt_secret_smartattend_2026
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Facial Recognition Model Configuration
INSIGHTFACE_MODEL=buffalo_sc
SIMILARITY_THRESHOLD=0.60
DETECTION_SIZE=640
```

### Step 4: Seed Initial Accounts (Automatic & Manual)

- **Automatic**: When the FastAPI server boots up, it automatically seeds default `admin` and `operator` credentials if the `users` collection is empty.
- **Manual Provisioning**:
  ```bash
  python scripts/create_user.py --username admin --password "admin123" --role admin
  python scripts/create_user.py --username operator --password "operator123" --role operator
  ```

### Step 5: Start the FastAPI Backend Server

```bash
uvicorn main:app --reload --port 8000
```
- API Root: `http://localhost:8000`
- Interactive Swagger UI: `http://localhost:8000/docs`
- Alternative ReDoc: `http://localhost:8000/redoc`

---

## 💻 4. Frontend Client Setup (`frontend/`)

Open a new terminal window:

```bash
cd frontend
npm install
```

### Configure Client Environment
Create or verify `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
```

### Launch Vite Development Server
```bash
npm run dev
```
Open your browser and navigate to:
👉 **`http://localhost:5173`**

---

## ⚡ Demo Credentials & Quick Test

| Role | Username | Password | Permitted Actions |
|---|---|---|---|
| **Administrator** | `admin` | `admin123` | Full access: Biometric enrollment, people directory, heatmaps & reports, user provisioning, CSV exports. |
| **Operator** | `operator` | `operator123` | Operational access: Live camera surveillance, attendance scanning, session lifecycle management. |

### End-to-End Workflow:
1. **Login as Admin**: Click the 1-tap Admin preset button on the login screen.
2. **Enroll a Person**: Navigate to **Enroll Person** and upload clear facial photos. Watch the biometric quality gate evaluate lighting, pose angle, and resolution before storing the 512-d embeddings.
3. **Start a Session**: Navigate to **Sessions** and create a new session (e.g. *"Morning CS101 Lecture"*).
4. **Scan Attendance**: Switch to **Live Attendance / Scan**, present a photo or camera feed, and watch the system identify faces in $<500$ms with green bounding boxes and idempotent attendance logging!
5. **View Reports**: Inspect the 14-day heatmap and analytics dashboard to verify recorded attendances.
