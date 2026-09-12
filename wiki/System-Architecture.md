# 🏗️ System Architecture & Compute Engine

SmartAttend is engineered as an asynchronous, decoupled client-server architecture balancing compute-heavy computer vision tasks with high-throughput I/O persistence.

---

## 1. High-Level Architectural Model

```mermaid
flowchart TD
    Client["Client Devices / Browser Streams"] --> SPA["React 18 + Vite SPA\n(FitTrack Editorial UI)"]
    SPA -- "REST API (Bearer JWT / X-API-Key)" --> Gateway["FastAPI Gateway"]

    subgraph Security Layer
        CORS["Strict CORS Guard\n(Rejects * at startup)"]
        SlowAPI["SlowAPI Rate Limiter\n(10-20 req/min on CV endpoints)"]
        RBAC["JWT Verification & Role Gate\n(Operator / Admin)"]
        Validation["Decompression & Dimension Validator\n(Pillow Verify + 6000px limit)"]
    end

    Gateway --> CORS --> SlowAPI --> RBAC --> Validation

    subgraph Compute Layer
        ThreadPool["ThreadPoolExecutor\n(CPU-bound OpenCV & InsightFace)"]
        EventLoop["AsyncIO Event Loop\n(I/O-bound Motor operations)"]
    end

    Validation --> ThreadPool
    Validation --> EventLoop

    subgraph Vision Engine
        CLAHE["CLAHE Lighting Normalization"]
        InsightFace["InsightFace ONNX (buffalo_sc)\n(RetinaFace + ArcFace)"]
        CosineSim["Cosine Similarity Matcher"]
    end

    ThreadPool --> CLAHE --> InsightFace --> CosineSim

    subgraph Persistence Layer
        Motor["Async Motor Driver"]
        MongoDB[("MongoDB Atlas\n(users, persons, sessions,\nattendance, face_encodings)")]
        AzureBlob[("Azure Blob Storage\n(Optional photo archival)")]
    end

    CosineSim --> Motor --> MongoDB
    Validation -.-> AzureBlob
```

---

## 2. Decoupled Compute Architecture

### CPU vs. I/O Separation
- **I/O Non-blocking Execution**: All database queries, user management, and session transactions run natively on the Python `asyncio` event loop using **Motor** (`AsyncIOMotorClient`).
- **CPU-bound Offloading**: Computer vision inference (RetinaFace detection, landmark alignment, ArcFace feature extraction) runs synchronously via a threadpool executor to avoid starving the `asyncio` event loop.

### Scaling & Bottleneck Triggers
Biometric matching is currently performed using in-memory vectorized cosine similarity. The system logs structured performance metrics to monitor:
- **Threshold 1**: Active enrolled individuals > **500 persons**.
- **Threshold 2**: 95th-percentile (`p95`) identification latency > **2.0 seconds**.

#### Scaling Roadmap:
1. **Tier 1 (In-Memory Matrix)**: Cache normalized 512-d embeddings as a contiguous NumPy array, invalidated upon enroll/delete operations.
2. **Tier 2 (Vector Database)**: Migrate matching logic to **MongoDB Atlas Vector Search** (HNSW index) or dedicated vector store (FAISS / Milvus).
