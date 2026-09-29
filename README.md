# 🎓 SmartAttend — AI Biometric Attendance System & Modular Monorepo

[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite 5](https://img.shields.io/badge/Vite-5-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Motor%20Async-47A248.svg?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![InsightFace](https://img.shields.io/badge/AI-InsightFace%20ONNX-FF6F00.svg?style=flat)](https://github.com/deepinsight/insightface)
[![Tests](https://img.shields.io/badge/Tests-Backend%20+%20Frontend%20+%20Packages%20Passed-brightgreen.svg?style=flat)](#-testing--verification)
[![Wiki](https://img.shields.io/badge/Wiki-Comprehensive%20Handbook-blueviolet.svg?style=flat)](https://github.com/Jashan-randhawa/AI-Attendance-System/wiki)
[![Vercel](https://img.shields.io/badge/Vercel-Analytics%20&%20Speed%20Insights-black.svg?style=flat&logo=vercel)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat)](LICENSE)

High-throughput, privacy-first facial recognition attendance platform featuring local neural inference with **InsightFace ONNX**, non-blocking async persistence with **MongoDB Atlas (Motor)**, role-based access control (**per-user JWT + salted scrypt**), an editorial **React 18 + Vite** dashboard with **mobile-responsive dual navigation**, and a suite of decoupled open-source packages published under the **`@jashan-randhawa`** scope.

> 📖 **Explore the Official Engineering Wiki**: For complete deep dives into neural vision pipelines, mathematical vector normalization, quality heuristics, REST endpoints, and deployment patterns, visit the [SmartAttend Wiki](https://github.com/Jashan-randhawa/AI-Attendance-System/wiki).

---

## ⚡ Demo Credentials

| Role | Username | Password | Access Level |
|---|---|---|---|
| **Administrator** | `admin` | `admin123` | Full access: Biometric enrollment, people directory, analytics & heatmaps, user management, system diagnostics, and CSV export |
| **Operator** | `operator` | `operator123` | Operational access: Live camera surveillance, instant attendance scanning, session lifecycle management, and record lookups |

*1-click preset buttons are available directly on the login screen with automatic initial credential seeding.*

---

## ✨ Key Features

- **Sub-Second Biometric Inference**: Multi-subject identification and attendance marking in $<500$ms without cloud compute dependencies.
- **Biometric Quality Gates**: Automated validation filtering on blur, bounding box dimensions ($\ge 60$px), 5% border margin clearance, and keypoint pupil distance pose angles.
- **Compensating Transaction Rollback**: Automatically reverts database records and prevents orphaned facial vectors upon any downstream persistence failure.
- **Engine-Level Idempotency**: Compound unique indexes `(person_id, session_id)` paired with domain cooldown classification (`IMMEDIATE_RETRY` $\le 15$s) guarantee zero double-marking.
- **Biometric Privacy by Design**: 512-d unit-normalized float vectors are mathematically non-reversible; camera frames are processed in volatile RAM with zero persistent raw photo retention.
- **FitTrack-Inspired Editorial UI**:
  - Editorial typography (`Playfair Display` serif + `Inter` sans-serif).
  - Organic 60-30-10 palette (Warm Parchment, Deep Ink, Emerald Accent, Golden Hour).
  - Emil Kowalski micro-interactions: tactile depress feedback, animated laser scan line, and contextSafe match flashes.
  - Native Dark / Light mode toggle with persistent state.
- **Mobile Web Adaptation & Dual Navigation**:
  - **Desktop (`md:` and up)**: 68px compact icon rail expanding to 280px on hover with pin lock and zero-layout-shift spacer rail.
  - **Mobile (`< md`)**: Sticky top bar with quick theme toggle & drawer menu + Fixed bottom tab bar with iOS safe area handling (`pb-safe`).
  - **Mobile Camera Controls**: Front/rear lens switcher (`user` vs `environment`), mirror preview toggle, flash control, and vertically stacked recognition cards.
  - **Window View Modes & Fullscreen**: Fluid fit screen mode (`max-w-none`) and HTML5 Fullscreen API integration for dedicated kiosk tablets.
- **Real User Monitoring (RUM)**: Built-in Vercel Web Analytics & Speed Insights tracking Core Web Vitals.
- **Analytics & Heatmaps**: 7/30/90-day attendance trends, headcount distributions, 14-day heatmap matrices, and defaulter tracking (<75%).

---

## 📦 Modular Monorepo Packages

This monorepo uses **npm workspaces** to publish decoupled, provider-neutral open-source packages extracted from SmartAttend:

| Package | Language | Registry | Description | Documentation |
| :--- | :---: | :---: | :--- | :--- |
| **[`@jashan-randhawa/face-matching-core`](./packages/face-matching-core)** | TypeScript | npm | Vector $L_2$ normalization, cosine similarity engine, threshold classification, and top-K candidate matching | [README](./packages/face-matching-core/README.md) · [Wiki](https://github.com/Jashan-randhawa/AI-Attendance-System/wiki/Modular-Packages-and-Monorepo#31-jashan-randhawaface-matching-core) |
| **[`@jashan-randhawa/attendance-contracts`](./packages/attendance-contracts)** | TypeScript | npm | Shared domain entity types and API request/response contracts matching FastAPI Pydantic models | [README](./packages/attendance-contracts/README.md) · [Wiki](https://github.com/Jashan-randhawa/AI-Attendance-System/wiki/Modular-Packages-and-Monorepo#32-jashan-randhawaattendance-contracts) |
| **[`@jashan-randhawa/smartattend-client`](./packages/smartattend-client)** | TypeScript | npm | Production-ready typed HTTP client SDK with automatic Bearer token injection for Node.js, browsers & mobile | [README](./packages/smartattend-client/README.md) · [Wiki](https://github.com/Jashan-randhawa/AI-Attendance-System/wiki/Modular-Packages-and-Monorepo#33-jashan-randhawasmartattend-client) |
| **[`@jashan-randhawa/face-quality-gates`](./packages/face-quality-gates)** | TypeScript | npm | Biometric face image quality rules, pose angle limits, edge margins, and diagnostics | [README](./packages/face-quality-gates/README.md) · [Wiki](https://github.com/Jashan-randhawa/AI-Attendance-System/wiki/Modular-Packages-and-Monorepo#34-jashan-randhawaface-quality-gates) |
| **[`@jashan-randhawa/attendance-domain-core`](./packages/attendance-domain-core)** | TypeScript | npm | Database-neutral attendance marking idempotency rules and duplicate classification | [README](./packages/attendance-domain-core/README.md) · [Wiki](https://github.com/Jashan-randhawa/AI-Attendance-System/wiki/Modular-Packages-and-Monorepo#35-jashan-randhawaattendance-domain-core) |
| **[`smartattend-face-matching`](./packages/python/face-matching-core)** | Python | PyPI | Pure Python & NumPy vector normalization, cosine similarity, and candidate ranking | [README](./packages/python/face-matching-core/README.md) · [Wiki](https://github.com/Jashan-randhawa/AI-Attendance-System/wiki/Modular-Packages-and-Monorepo#36-smartattend-face-matching-python) |

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client Layer
        Web["React 18 + Vite SPA\n(FitTrack Editorial UI)"]
        Mobile["Mobile & Tablet Kiosks\n(Dual Nav + Camera Switcher)"]
        SDK["@jashan-randhawa/smartattend-client\n(Node.js / Scripts / Microservices)"]
    end

    subgraph Core Libraries
        Contracts["@jashan-randhawa/attendance-contracts"]
        MatchingCore["@jashan-randhawa/face-matching-core"]
        QualityCore["@jashan-randhawa/face-quality-gates"]
        DomainCore["@jashan-randhawa/attendance-domain-core"]
    end

    Web & Mobile & SDK --> Contracts
    Web & Mobile & SDK --> QualityCore
    Web & Mobile & SDK --> MatchingCore
    Web & Mobile & SDK --> DomainCore

    Web & Mobile & SDK -- "Bearer JWT / REST" --> Gateway["FastAPI Gateway\n(SlowAPI Rate Limiting + RBAC)"]

    subgraph Compute & Inference
        CLAHE["CLAHE Contrast Equalization\n(LAB Color Space)"]
        InsightFace["InsightFace ONNX (buffalo_sc)\n(RetinaFace + ArcFace 512-d)"]
        Matcher["Cosine Similarity Engine\n(smartattend-face-matching)"]
    end

    Gateway --> CLAHE --> InsightFace --> Matcher

    subgraph Persistence
        Motor["Async Motor Driver"]
        DB[("MongoDB Atlas\n(users, persons, sessions,\nattendance, face_encodings)")]
    end

    Matcher --> Motor --> DB

    subgraph Telemetry
        Vercel["Vercel Analytics & Speed Insights"]
    end

    Web & Mobile -.-> Vercel
```

---

## 🛠️ Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| **Backend Framework** | FastAPI 0.115+ (Python 3.11+) | Async REST API, Pydantic validation, and dependency injection |
| **Vision Inference** | InsightFace (`buffalo_sc`) + ONNX Runtime | Local CPU/GPU face detection and 512-d feature vector extraction |
| **Image Preprocessing** | OpenCV (CLAHE) + Pillow | Lighting equalization, channel split, and safety dimension validation |
| **Database** | MongoDB Atlas via Motor | Non-blocking asynchronous document persistence |
| **Security & Auth** | PyJWT + `hashlib.scrypt` + SlowAPI | Signed Bearer JWTs, salted password hashing, rate limiting |
| **Frontend Framework** | React 18 + Vite 5 + TypeScript 5 | Single-page application with code splitting and route protection |
| **UI & Styling** | Tailwind CSS + Lucide Icons | Editorial layout, responsive dual navigation, and layered shadows |
| **State & Animations** | TanStack Query v5 + GSAP | Server-state caching and Emil Kowalski micro-interactions |
| **Telemetry** | `@vercel/analytics` + `@vercel/speed-insights` | Real User Monitoring (RUM) and Core Web Vitals tracking |
| **Monorepo Ecosystem** | npm workspaces + GitHub Actions | Decoupled libraries with continuous integration and automated publishing |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Python 3.11+**
- **Node.js 18+** & `npm`
- **MongoDB Atlas** connection string (or local MongoDB v6.0+)

### 2. Monorepo Installation & Package Verification
```bash
git clone https://github.com/Jashan-randhawa/AI-Attendance-System.git
cd AI-Attendance-System

# Install root npm workspace dependencies:
npm install

# Run unit tests across all modular packages:
npm test

# Run runnable examples:
node examples/matching-and-quality-demo.js
node examples/client-sdk-demo.js
```

### 3. Backend Setup (`backend/`)
```bash
cd backend
python -m venv venv

# Windows PowerShell:
venv\Scripts\Activate.ps1
# Linux / macOS:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Configure MONGODB_URL and JWT_SECRET in backend/.env
```

Start the backend server (automatically seeds default admin/operator if empty):
```bash
uvicorn main:app --reload --port 8000
```
- Interactive Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Alternative ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 4. Frontend Setup (`frontend/`)
```bash
cd ../frontend
npm install
cp .env.example .env
# Verify VITE_API_URL=http://localhost:8000
npm run dev
```
- Open browser: 👉 [http://localhost:5173](http://localhost:5173)

---

## 📡 API Overview

All protected routes accept `Authorization: Bearer <JWT>` or `X-API-Key: <key>`.

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/api/auth/token` | Public | Authenticate user credentials & issue signed JWT |
| `GET` | `/api/auth/me` | Operator | Fetch current authenticated user profile |
| `POST` | `/api/auth/register` | Admin | Provision new user account |
| `GET` | `/api/persons` | Admin | List active enrolled individuals |
| `POST` | `/api/persons/enroll` | Admin | Biometric enrollment with quality gate & compensating rollback |
| `POST` | `/api/persons/enroll/analyze` | Admin | Pre-enrollment image quality diagnostic |
| `DELETE`| `/api/persons/{id}` | Admin | Soft-delete person record |
| `GET` | `/api/sessions` | Operator | List attendance sessions (`?active=true`) |
| `POST` | `/api/sessions` | Operator | Create a new attendance session |
| `PATCH`| `/api/sessions/{id}/end` | Operator | Conclude an active session |
| `POST` | `/api/attendance/identify` | Operator | Detect & identify faces with bounding boxes |
| `POST` | `/api/attendance/mark/{session_id}` | Operator | Identify and idempotently record attendance |
| `GET` | `/api/attendance` | Operator | Query attendance records with multi-filters |
| `GET` | `/api/attendance/export/csv` | Admin | Download attendance data as CSV |
| `GET` | `/api/dashboard/metrics` | Operator | KPI summary cards (enrolled, sessions, rates) |
| `GET` | `/api/reports/daily` | Admin | Attendance trend curves over `?days=N` |
| `GET` | `/api/reports/heatmap` | Admin | 14-day individual presence matrix |

---

## 🧪 Testing & Verification

```bash
# 1. Run all npm workspace package test suites:
npm test

# 2. Run backend test suite (63 unit & integration tests):
cd backend
pytest -v

# 3. Run frontend test suite & production bundle build:
cd ../frontend
npm test
npm run build
```

---

## 🐳 Docker & Production Deployment

### Run with Docker
```bash
docker build -t smart-attend-backend ./backend
docker run -d -p 8000:8000 --env-file ./backend/.env smart-attend-backend
```

### Cloud Platforms
- **Backend (Render / Railway / Azure App Service)**: Deploy using `backend/Dockerfile` with `/health` probe path.
- **Frontend (Vercel / Netlify)**: Deploy `frontend/` directory with build command `npm run build` and output directory `dist`.
- **Packages (GitHub Packages Registry)**: Automated deployment on release via `.github/workflows/publish-packages.yml`.

---

## 🔒 Security & Biometric Data Privacy

Please review our [SECURITY.md](SECURITY.md) for vulnerability reporting guidelines and biometric privacy principles:
- **Non-Reversible Embeddings**: Biometric features exist strictly as 512-d mathematical floating-point vectors that cannot reconstruct the original human likeness.
- **Ephemeral RAM Processing**: Live video streams and scan uploads are processed strictly in volatile memory and immediately discarded.
- **Responsible Disclosure**: Private vulnerability reports can be submitted via [GitHub Security Advisories](https://github.com/Jashan-randhawa/AI-Attendance-System/security/advisories/new).

---

## 📄 License

Licensed under the [MIT License](LICENSE).
