FROM python:3.11-slim

WORKDIR /app

# g++ needed for insightface's Cython extension + runtime libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    libgomp1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the InsightFace buffalo_sc model into the image layer.
# This runs once at build time, so cold starts don't waste ~60s downloading it.
RUN python - <<'EOF'
from insightface.app import FaceAnalysis
app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
app.prepare(ctx_id=-1, det_size=(640, 640))
print("InsightFace buffalo_sc model cached in image.")
EOF

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
