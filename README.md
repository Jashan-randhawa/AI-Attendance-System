# Smart Attendance System

AI-powered attendance system using Azure Face Recognition + MongoDB Atlas.

## Project Structure
```
smart-attendance-full/
├── backend/        # FastAPI + Motor (MongoDB) + Azure Face API
└── frontend/       # React + Vite + TailwindCSS
```

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL
npm run dev
```

## Environment Variables

### Backend (.env)
- `MONGODB_URL` — MongoDB Atlas connection string
- `MONGODB_DB_NAME` — Database name (default: attendance_db)
- `AZURE_FACE_KEY` — Azure Face API key
- `AZURE_FACE_ENDPOINT` — Azure Face API endpoint
- `AZURE_STORAGE_CONNECTION_STRING` — Azure Blob Storage
- `PERSON_GROUP_ID` — Face group ID (lowercase, no spaces)
- `ALLOWED_ORIGINS` — Frontend URL for CORS

### Frontend (.env)
- `VITE_API_URL` — Backend URL (e.g. https://your-backend.onrender.com)

## Deployment (Render)
1. Deploy backend as a Web Service
2. Deploy frontend as a Static Site (build: `npm run build`, publish: `dist`)
3. Set all env vars in Render dashboard
