# 📦 Modular Packages & Monorepo Architecture

SmartAttend is engineered as an enterprise-grade monorepo combining a full-stack AI attendance platform with a suite of decoupled, standalone libraries published under the `@jashan-randhawa` scope.

These packages extract the core computer vision algorithms, entity contracts, quality heuristics, domain idempotency rules, and HTTP client SDK into reusable npm and PyPI modules that can be consumed by external web applications, mobile apps, edge devices, and backend microservices.

---

## 1. Monorepo Overview & Layout

The repository utilizes **npm workspaces** to manage inter-package dependencies, centralized continuous integration, and automated registry publishing:

```
AI-Attendance-System/
├── LICENSE                         # Monorepo MIT license
├── SECURITY.md                     # Biometric privacy & vulnerability reporting policy
├── package.json                    # Root npm workspace configuration
├── .github/
│   └── workflows/
│       ├── packages-ci.yml         # Automated typechecking, unit tests & tarball smoke tests
│       └── publish-packages.yml    # Automated publishing to GitHub Packages registry
├── packages/
│   ├── face-matching-core/         # @jashan-randhawa/face-matching-core
│   ├── attendance-contracts/       # @jashan-randhawa/attendance-contracts
│   ├── smartattend-client/         # @jashan-randhawa/smartattend-client
│   ├── face-quality-gates/         # @jashan-randhawa/face-quality-gates
│   ├── attendance-domain-core/     # @jashan-randhawa/attendance-domain-core
│   └── python/
│       └── face-matching-core/     # smartattend-face-matching (Python wheel/sdist)
├── examples/
│   ├── matching-and-quality-demo.js # Standalone runnable matching & quality verification
│   └── client-sdk-demo.js          # Standalone runnable client SDK integration demo
├── backend/                        # FastAPI + Motor (MongoDB) + InsightFace server
└── frontend/                       # React 18 + Vite + Tailwind CSS dashboard
```

---

## 2. Published Packages Matrix

| Package | Registry | Ecosystem | Description |
| :--- | :---: | :---: | :--- |
| **`@jashan-randhawa/face-matching-core`** | GitHub Packages / npm | TypeScript / JS | Vector L2 normalization, cosine similarity engine, and top-K candidate matching |
| **`@jashan-randhawa/attendance-contracts`** | GitHub Packages / npm | TypeScript / JS | Shared domain entity types and API request/response contracts matching FastAPI schemas |
| **`@jashan-randhawa/smartattend-client`** | GitHub Packages / npm | TypeScript / JS | Production-ready typed HTTP client SDK for browser, Node.js, and mobile clients |
| **`@jashan-randhawa/face-quality-gates`** | GitHub Packages / npm | TypeScript / JS | Biometric face image quality rules, pose angle limits, edge margins, and diagnostics |
| **`@jashan-randhawa/attendance-domain-core`** | GitHub Packages / npm | TypeScript / JS | Database-neutral attendance marking idempotency rules and duplicate classification |
| **`smartattend-face-matching`** | PyPI / GitHub | Python 3.10+ | Pure Python & NumPy vector normalization, cosine similarity, and candidate ranking |

---

## 3. Package Deep Dives

### 3.1. `@jashan-randhawa/face-matching-core`

A provider-neutral, high-performance vector matching library designed for facial recognition embeddings (ArcFace, FaceNet, InsightFace, etc.).

#### Mathematical Formulation
Given two 512-dimensional feature vectors $\mathbf{u}$ and $\mathbf{v}$, the cosine similarity $S_C(\mathbf{u}, \mathbf{v})$ represents the cosine of the angle between them:

$$S_C(\mathbf{u}, \mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2} = \frac{\sum_{i=1}^n u_i v_i}{\sqrt{\sum_{i=1}^n u_i^2} \sqrt{\sum_{i=1}^n v_i^2}}$$

When vectors are pre-normalized to unit length ($\|\mathbf{u}\|_2 = 1$), cosine similarity simplifies to a fast dot product:

$$S_C(\mathbf{u}, \mathbf{v}) = \mathbf{u} \cdot \mathbf{v} = \sum_{i=1}^n u_i v_i$$

#### Key Functions

- **`validateEmbedding(v, expectedDim?)`**: Validates vector presence, dimension consistency, and asserts all elements are finite numbers (no `NaN` or `Infinity`).
- **`vectorNorm(v)`**: Computes Euclidean $L_2$ norm.
- **`normalizeEmbedding(v)`**: Normalizes vector to unit length ($L_2 = 1.0$), returning a `Float32Array`.
- **`cosineSimilarity(v1, v2)`**: Computes bounded cosine similarity in range $[-1.0, 1.0]$.
- **`classifySimilarity(similarity, threshold?)`**: Returns `{ isMatch: boolean, confidence: number }` based on configured threshold (default `0.40`).
- **`rankCandidates(queryEmbedding, candidates, options?)`**: Sorts candidates in descending order of similarity, filters by `minConfidence`, and slices to `topK`.
- **`findBestMatch(queryEmbedding, candidates, options?)`**: Returns the top matching candidate or `null` if none meet the threshold.
- **`isDuplicateCandidate(newEmbedding, existingEmbeddings, duplicateThreshold?)`**: Detects if an enrollment photo matches an already enrolled subject (default threshold `0.45`).

#### Usage Example
```typescript
import {
  cosineSimilarity,
  normalizeEmbedding,
  findBestMatch,
  DEFAULT_CONFIDENCE_THRESHOLD,
} from "@jashan-randhawa/face-matching-core";

const enrolledNorm = normalizeEmbedding(enrolledVector);
const probeNorm = normalizeEmbedding(cameraProbeVector);

const similarity = cosineSimilarity(enrolledNorm, probeNorm);
console.log(`Cosine Similarity: ${similarity.toFixed(4)}`);

const bestMatch = findBestMatch(probeNorm, candidates, {
  threshold: DEFAULT_CONFIDENCE_THRESHOLD, // 0.40
  topK: 1,
});

if (bestMatch && bestMatch.isMatch) {
  console.log(`Identified: ${bestMatch.id} with confidence ${bestMatch.similarity}`);
}
```

---

### 3.2. `@jashan-randhawa/attendance-contracts`

Provides end-to-end TypeScript entity schemas and API payload contracts matching FastAPI Pydantic models. Guarantees compile-time type safety across frontend, mobile, and client SDKs.

#### Schema Categories

1. **User & Auth**:
   - `UserRole`: `"operator" | "admin"`
   - `User`, `AuthToken`, `LoginPayload`, `RegisterPayload`
2. **Persons & Enrollment**:
   - `PersonCreate`, `Person`, `PersonOut`
3. **Session Lifecycle**:
   - `SessionCreate`, `Session`
4. **Attendance Tracking**:
   - `AttendanceStatus`: `"present" | "late" | "absent"`
   - `AttendanceLog`, `MarkAttendancePayload`, `MarkAttendanceResult`
5. **Computer Vision & Inference**:
   - `FaceBox`: `{ x: number, y: number, width: number, height: number, confidence: number }`
   - `RecognitionResult`: `{ person_id: string, name: string, confidence: number, box: FaceBox }`
6. **Analytics & Diagnostics**:
   - `SystemStats`, `DailyAttendanceStat`, `HeatmapCell`, `DefaulterStudent`
7. **Runtime Validators**:
   - `isValidRole(val)`, `isValidAttendanceStatus(val)`, `isValidEmail(email)`

---

### 3.3. `@jashan-randhawa/smartattend-client`

A zero-dependency, isomorphic HTTP client SDK for integrating SmartAttend into Node.js scripts, web apps, Electron kiosks, or React Native attendance terminals.

#### Key Features
- **Automatic Bearer Token Injection**: Manages JWT credentials via pluggable storage adapters (`MemoryStorageAdapter`, `localStorage`, or AsyncStorage).
- **Strongly Typed Responses**: Full TypeScript support powered by `@jashan-randhawa/attendance-contracts`.
- **Structured Error Handling**: Throws `ApiError` with HTTP status code and server payload.

#### API Reference

```typescript
import { SmartAttendClient } from "@jashan-randhawa/smartattend-client";

const client = new SmartAttendClient({
  baseUrl: "http://localhost:8000",
});

// 1. Authentication
await client.login("admin", "admin123");

// 2. People Directory
const persons = await client.getPersons({ department: "Computer Science" });

// 3. Biometric Enrollment (multipart/form-data)
const formData = new FormData();
formData.append("name", "John Doe");
formData.append("department", "Engineering");
formData.append("file", imageBlob, "face.jpg");
const newPerson = await client.enrollPerson(formData);

// 4. Session Lifecycle
const session = await client.createSession({
  label: "CS101 Morning Lecture",
  department: "Engineering",
});

// 5. Multi-Subject Facial Recognition
const results = await client.identify(cameraFrameBlob);

// 6. Idempotent Attendance Marking
for (const match of results.matches) {
  await client.markAttendance(session.id, match.person_id);
}

// 7. Analytics & Defaulters (< 75% attendance)
const defaulters = await client.getDefaulters({ threshold: 75 });
const diagnostics = await client.getDiagnostics();
```

---

### 3.4. `@jashan-randhawa/face-quality-gates`

Biometric quality assessment engine ensuring that photos submitted during enrollment or surveillance satisfy stringent facial recognition standards before feature extraction.

#### Default Thresholds (`DEFAULT_QUALITY_THRESHOLDS`)
- **`minScore: 0.60`**: InsightFace detection confidence threshold.
- **`minFaceWidth: 60px`**, **`minFaceHeight: 60px`**: Rejects distant or blurry subjects.
- **`marginRatio: 0.05`**: Requires 5% border margin clearance so faces are not truncated at camera edges.
- **`minEyeDistanceRatio: 0.20`**: Landmark eye distance must exceed 20% of face width (rejects extreme yaw/pitch profiles).
- **`maxFacesAllowed: 1`**: Ensures enrollment photos contain exactly one subject.

#### Key Functions
- **`checkFaceQuality(face, imageWidth, imageHeight, thresholds?)`**: Evaluates a detected face against all quality gates, returning `{ passed: boolean, reasons: string[], diagnostics }`.
- **`validateEnrollmentImage(faces, imageWidth, imageHeight, thresholds?)`**: Validates that an image contains exactly one high-quality face suitable for biometric vector enrollment.
- **`parseBoundingBox(bbox)`**: Normalizes both array-based `[x1, y1, x2, y2]` and object-based `{x, y, width, height}` bounding boxes.
- **`calculateEyeDistanceRatio(landmarks, faceWidth)`**: Computes Euclidean distance between left and right pupil landmarks relative to bounding box width.

---

### 3.5. `@jashan-randhawa/attendance-domain-core`

Contains database-neutral business logic and idempotency rules for marking attendance, classifying duplicate events, and computing compliance statistics.

#### Core Rules & Methods

1. **Session State Validation (`validateSessionState`)**:
   - Asserts session exists, `is_active === true`, and `ended_at === null`.
2. **Duplicate Classification (`classifyDuplicate`)**:
   - Classifies an incoming mark event:
     - `IMMEDIATE_RETRY` (elapsed $\le 15$ seconds): Camera jitter or repeated frame capture.
     - `SAME_SESSION_DUPLICATE` (elapsed $> 15$ seconds): Subject scanned again in the same active session.
3. **Idempotency Decision Engine (`shouldMarkAttendance`)**:
   - Determines whether an attendance record should be created, returning `{ canMark: boolean, reason?: string, existingRecord?: AttendanceRecordLike }`.
4. **Compliance Calculation (`calculateStudentAttendanceRate`)**:
   - Calculates student attendance percentage: $\text{Rate} = \frac{\text{Sessions Attended}}{\text{Total Sessions Held}} \times 100\%$.
5. **Defaulter Filtering (`filterDefaulters`)**:
   - Filters students falling below attendance threshold (default 75%).

---

### 3.6. `smartattend-face-matching` (Python)

A standalone Python library (`packages/python/face-matching-core`) providing identical vector operations for Python backend microservices, scripts, and embedded Raspberry Pi / Jetson edge devices.

```python
from smartattend_face_matching import (
    cosine_similarity,
    normalize_embedding,
    rank_candidates,
    find_best_match,
)

# Unit normalization
norm_a = normalize_embedding(embedding_a)
norm_b = normalize_embedding(embedding_b)

# Vector cosine similarity
sim = cosine_similarity(norm_a, norm_b)

# Top candidate lookup
best = find_best_match(norm_a, candidates, threshold=0.40)
if best and best.is_match:
    print(f"Matched {best.id} with confidence {best.similarity:.4f}")
```

---

## 4. Continuous Integration & Publishing

### Automated CI Workflow (`.github/workflows/packages-ci.yml`)
Runs on every push to `main` and all pull requests touching `packages/**`:
1. **Workspace Installation**: `npm ci` from the repository root.
2. **Typecheck & Build**: Compiles TypeScript declaration files (`.d.ts`) and ESM output across all 5 TypeScript packages.
3. **Unit Tests**: Executes test suites across each package (`npm test`).
4. **Tarball Packaging & Smoke Test**: Executes `npm pack` and verifies package tarball integrity.
5. **Python Verification**: Installs `packages/python/face-matching-core` with `pip install .` and verifies import and matching execution.

### Publishing Workflow (`.github/workflows/publish-packages.yml`)
Automatically triggers on new releases or manually via `workflow_dispatch`:
- Publishes all packages to the **GitHub Packages Registry** under the `@jashan-randhawa` scope.
- Automatically generates provenance and semantic version metadata.

---

## 5. Developer Verification & Examples

To test all packages locally:

```bash
# Run unit tests across all npm workspace packages:
npm test

# Run individual package tests:
npm --workspace=@jashan-randhawa/face-matching-core test
npm --workspace=@jashan-randhawa/attendance-contracts test
npm --workspace=@jashan-randhawa/smartattend-client test
npm --workspace=@jashan-randhawa/face-quality-gates test
npm --workspace=@jashan-randhawa/attendance-domain-core test

# Run runnable demo scripts:
node examples/matching-and-quality-demo.js
node examples/client-sdk-demo.js
```
