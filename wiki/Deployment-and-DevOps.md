# 🚀 Deployment, DevOps & Health Monitoring

SmartAttend is designed for flexible deployment across containers, serverless frontends, and managed application platforms.

---

## 1. Docker Multi-Stage Containerization

The backend includes a production-optimized `Dockerfile` using `python:3.11-slim`:

```dockerfile
# Build image
docker build -t smart-attend-backend ./backend

# Run with environment file
docker run -d \
  --name smart-attend \
  -p 8000:8000 \
  --env-file ./backend/.env \
  --restart unless-stopped \
  smart-attend-backend
```

Features:
- Pre-compiles InsightFace native Cython extensions.
- Downloads `buffalo_sc` neural weights during build time to eliminate cold-start latency.
- Runs without root privileges for container security.

---

## 2. Platform Deployments

### Backend on Render / Railway
1. Connect GitHub repository and select `Docker` runtime pointing to `backend/Dockerfile`.
2. Configure environment variables (`MONGODB_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS`).
3. Set health check endpoint to `GET /health` (returns `{"status": "ok"}`).

### Frontend on Vercel / Netlify
1. Set Root Directory to `frontend`.
2. Set Build Command to `npm run build`.
3. Set Output Directory to `dist`.
4. Configure environment variable: `VITE_API_URL=https://your-backend-api.onrender.com`.

---

## 3. Structured Logging & Correlation IDs

Incoming requests are stamped with a unique `X-Request-ID` header. All server logs include this correlation ID for distributed tracing:
```
[2026-09-12 14:02:18] [INFO] [req_9f3b81] POST /api/attendance/mark/66e2d148 - Identified 2 faces in 284ms
```

---

## 4. Disaster Recovery & Secret Rotation

- **Disaster Recovery**: Automated point-in-time MongoDB Atlas restore instructions and collection drop recovery runbooks are maintained in [docs/DISASTER_RECOVERY.md](../docs/DISASTER_RECOVERY.md).
- **Secret Rotation**: Zero-downtime JWT secret and API key rotation procedures are detailed in [docs/SECRET_ROTATION.md](../docs/SECRET_ROTATION.md).
