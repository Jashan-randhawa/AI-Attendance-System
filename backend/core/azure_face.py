"""
core/azure_face.py  —  InsightFace backend with MongoDB-persisted encodings.

Face embeddings are stored in the `face_encodings` MongoDB collection so they
survive Render restarts / redeployments (unlike /tmp which is wiped on every
deploy).

Collection schema:
  face_encodings: {
    _id:        str   (person UUID, same value used as azure_person_id),
    name:       str,
    embeddings: [[float, ...], ...]   # one 512-d vector per enrolled photo
  }
"""

import os
import io
import time
import uuid
import asyncio
import inspect
import logging

import cv2
import numpy as np
from PIL import Image

from core.database import get_database
from core.logging_context import run_in_executor_ctx

logger = logging.getLogger(__name__)

# ── Lightweight timing metrics (Remediation Plan item #12) ────────────────────
#
# InsightFace inference is the CPU-heavy, performance-critical path in this
# service and previously had zero timing instrumentation — there was no way
# to tell if enroll/identify latency crept up short of a user complaining.
#
# This starts with plain perf_counter() timing logged at INFO level (cheap,
# zero new dependencies, immediately greppable/aggregable from log output).
# If this deployment ever sits behind a scraper, swap `_log_timing` for
# `prometheus-fastapi-instrumentator` counters/histograms without touching
# any call site below.
metrics_logger = logging.getLogger("attendance.metrics")


def _log_timing(operation: str, started_at: float, **fields) -> None:
    """Log a single structured timing line for an inference-path operation."""
    duration_ms = (time.perf_counter() - started_at) * 1000
    extra = " ".join(f"{k}={v}" for k, v in fields.items())
    metrics_logger.info("op=%s duration_ms=%.1f %s", operation, duration_ms, extra)


# ── Global face analysis model singleton ──────────────────────────────────────

_app = None

def _get_insight_app():
    """Lazily load the InsightFace model once per process."""
    global _app
    if _app is None:
        try:
            import onnxruntime as ort
            # Silence the "GPU device discovery failed" warning on CPU-only hosts.
            # severity: 0=VERBOSE 1=INFO 2=WARNING 3=ERROR 4=FATAL
            ort.set_default_logger_severity(3)

            from insightface.app import FaceAnalysis
            _app = FaceAnalysis(
                name="buffalo_sc",
                providers=["CPUExecutionProvider"],
            )
            _app.prepare(ctx_id=-1, det_size=(640, 640), det_thresh=0.3)
            logger.info("InsightFace model loaded (det_thresh=0.3, det_size=640).")
        except Exception as e:
            logger.error("InsightFace load failed: %s", e)
            raise RuntimeError(f"InsightFace not available: {e}")
    return _app


# ── Motor-backed Persistence helpers (Single MongoDB Client) ──────────────────

async def _load_all() -> dict:
    """
    Returns {person_id: {"name": str, "embeddings": [np.ndarray, ...]}}

    KNOWN LIMITATION (Remediation Plan item #13 — deferred, Effort: L):
    This pulls every enrolled person's embeddings into memory on every single
    identify/duplicate-check call — O(n) documents fetched + O(n) cosine
    similarity comparisons per call, with no caching. Fine at the current
    scale (tens to low hundreds of enrolled people); will not scale to
    thousands without added latency and MongoDB load.

    SCALING TRIGGER THRESHOLDS (Step 12):
    Revisit and implement caching / vector search when:
      1. Enrolled person count exceeds 500 active persons.
      2. Or p95 identify latency exceeds 2.0 seconds based on timing logs.
    Escalation Path:
      Tier 1: Cache the embedding matrix in-process as a NumPy array,
              invalidated on enroll/delete.
      Tier 2: Migrate to a vector index (MongoDB Atlas Vector Search or FAISS).
    """
    db = get_database()
    store = {}
    async for doc in db.face_encodings.find():
        pid = doc["_id"]
        store[pid] = {
            "name":       doc["name"],
            "embeddings": [np.array(e, dtype=np.float32) for e in doc["embeddings"]],
        }
    return store


async def _upsert_person(person_id: str, name: str, embeddings: list) -> None:
    db = get_database()
    await db.face_encodings.update_one(
        {"_id": person_id},
        {"$set": {
            "name":       name,
            "embeddings": [e.tolist() for e in embeddings],
        }},
        upsert=True,
    )


async def _delete_person_doc(person_id: str) -> None:
    db = get_database()
    await db.face_encodings.delete_one({"_id": person_id})


# ── Image pre-processing ──────────────────────────────────────────────────────

def _bytes_to_bgr(image_bytes: bytes) -> np.ndarray:
    img  = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    arr  = np.array(img)
    bgr  = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    h, w = bgr.shape[:2]
    if w > 1280:
        scale = 1280 / w
        bgr   = cv2.resize(bgr, (1280, int(h * scale)))
    lab  = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l     = clahe.apply(l)
    bgr   = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    return bgr


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def _cfg() -> dict:
    return {
        "threshold":      float(os.environ.get("MIN_CONFIDENCE", "0.40")),
        "dup_threshold":  float(os.environ.get("DUPLICATE_THRESHOLD", "0.45")),
        "blob_conn_str":  os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "").strip(),
        "blob_container": os.environ.get("AZURE_BLOB_CONTAINER", "attendance-photos").strip(),
    }


# ── Face quality check ────────────────────────────────────────────────────────

def _check_face_quality(face, image_w: int, image_h: int) -> tuple:
    det_score = float(face.det_score)
    if det_score < 0.60:
        return False, (
            f"Low detection confidence ({det_score:.2f} < 0.60). "
            "Use better lighting or a clearer photo."
        )

    box    = face.bbox.astype(int)
    face_w = box[2] - box[0]
    face_h = box[3] - box[1]
    if face_w < 60 or face_h < 60:
        return False, (
            f"Face too small ({face_w}x{face_h} px). Move closer to the camera."
        )

    margin_x = max(int(image_w * 0.05), 10)
    margin_y = max(int(image_h * 0.05), 10)
    if (box[0] < margin_x or box[1] < margin_y
            or box[2] > (image_w - margin_x) or box[3] > (image_h - margin_y)):
        return False, "Face is too close to the image edge. Center your face in the frame."

    kps = getattr(face, "kps", None)
    if kps is not None and len(kps) >= 2:
        eye_dist = float(np.linalg.norm(kps[1] - kps[0]))
        if eye_dist < face_w * 0.20:
            return False, (
                "Face appears to be at too extreme an angle. "
                "Please face the camera more directly."
            )

    return True, ""


# ── Public API ────────────────────────────────────────────────────────────────

async def ensure_person_group() -> None:
    loop = asyncio.get_event_loop()
    await run_in_executor_ctx(loop, _get_insight_app)
    logger.info("InsightFace backend ready.")


async def enroll_person(name: str, image_bytes_list: list) -> str:
    loop = asyncio.get_event_loop()

    def _encode_all():
        _t0            = time.perf_counter()
        fa             = _get_insight_app()
        person_id      = str(uuid.uuid4())
        new_embeddings = []
        quality_errors = []
        faces_detected = 0

        for idx, img_bytes in enumerate(image_bytes_list):
            try:
                bgr   = _bytes_to_bgr(img_bytes)
                h, w  = bgr.shape[:2]
                faces = fa.get(bgr)
                if not faces:
                    faces = fa.get(cv2.flip(bgr, 1))
                if not faces:
                    quality_errors.append(
                        f"Photo {idx+1}: No face detected. Ensure your face is clearly visible."
                    )
                    continue

                faces_detected += 1
                face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
                ok, reason = _check_face_quality(face, w, h)
                if not ok:
                    quality_errors.append(f"Photo {idx+1}: {reason}")
                    logger.warning("Photo %d failed quality check: %s", idx+1, reason)
                    continue

                new_embeddings.append(face.embedding)
                logger.info("Encoded face for '%s' photo %d (det_score=%.2f)",
                            name, idx+1, face.det_score)
            except Exception as e:
                logger.warning("Skipping photo %d: %s", idx+1, e)
                quality_errors.append(f"Photo {idx+1}: Processing error — {e}")

        if not new_embeddings:
            _log_timing("enroll", _t0, photos=len(image_bytes_list),
                        faces_detected=faces_detected, embeddings=0, result="rejected")
            detail = " | ".join(quality_errors) if quality_errors else (
                "No valid face detected in any of the provided images."
            )
            raise ValueError(detail)

        if len(new_embeddings) < len(image_bytes_list):
            logger.warning(
                "Only %d/%d photos passed quality check for '%s'. Issues: %s",
                len(new_embeddings), len(image_bytes_list), name,
                " | ".join(quality_errors),
            )

        return person_id, new_embeddings, _t0, faces_detected

    person_id, new_embeddings, _t0, faces_detected = await run_in_executor_ctx(loop, _encode_all)

    # Persist to MongoDB asynchronously using Motor — survives restarts
    await _upsert_person(person_id, name, new_embeddings)
    logger.info("Enrolled '%s' with %d embedding(s) in MongoDB. id=%s",
                name, len(new_embeddings), person_id)
    _log_timing("enroll", _t0, photos=len(image_bytes_list),
                faces_detected=faces_detected, embeddings=len(new_embeddings), result="ok")
    return person_id


async def delete_person(azure_person_id: str) -> None:
    await _delete_person_doc(azure_person_id)


async def identify_faces(image_bytes: bytes, confidence_threshold: float = None) -> list:
    cfg  = _cfg()
    loop = asyncio.get_event_loop()
    _t0  = time.perf_counter()

    raw_store = _load_all()
    store = await raw_store if inspect.isawaitable(raw_store) else raw_store
    if not store:
        logger.info("No enrolled persons in MongoDB face_encodings.")
        _log_timing("identify", _t0, faces_detected=0, matches=0, result="empty_store")
        return []

    def _identify():
        fa    = _get_insight_app()
        bgr   = _bytes_to_bgr(image_bytes)
        faces = fa.get(bgr)
        if not faces:
            bright = cv2.convertScaleAbs(bgr, alpha=1.3, beta=30)
            faces  = fa.get(bright)
        if not faces:
            logger.info("No faces detected in frame.")
            _log_timing("identify", _t0, faces_detected=0, matches=0, result="no_face")
            return []

        logger.info("Detected %d face(s) in frame.", len(faces))

        all_pids, all_names, all_embs = [], [], []
        for pid, data in store.items():
            for emb in data["embeddings"]:
                all_pids.append(pid)
                all_names.append(data["name"])
                all_embs.append(emb)

        threshold = confidence_threshold if confidence_threshold is not None else cfg["threshold"]
        results   = []

        for face in faces:
            unknown_emb  = face.embedding
            box          = face.bbox.astype(int)
            det_score    = float(face.det_score)
            similarities = [_cosine_similarity(unknown_emb, e) for e in all_embs]
            best_idx     = int(np.argmax(similarities))
            best_sim     = similarities[best_idx]

            logger.info(
                "Face det_score=%.2f best_match='%s' similarity=%.3f threshold=%.2f",
                det_score, all_names[best_idx], best_sim, threshold,
            )

            if best_sim < threshold:
                continue

            results.append({
                "azure_person_id": all_pids[best_idx],
                "name":            all_names[best_idx],
                "confidence":      round(best_sim, 4),
                "face_box": {
                    "left":   int(max(box[0], 0)),
                    "top":    int(max(box[1], 0)),
                    "width":  int(box[2] - box[0]),
                    "height": int(box[3] - box[1]),
                },
            })

        confidences = [r["confidence"] for r in results]
        _log_timing(
            "identify", _t0,
            faces_detected=len(faces), matches=len(results),
            enrolled_embeddings=len(all_embs),
            best_confidence=(f"{max(confidences):.3f}" if confidences else "-"),
            result="ok",
        )
        return results

    return await run_in_executor_ctx(loop, _identify)


async def upload_photo_to_blob(person_id: str, image_bytes: bytes, filename: str) -> str:
    cfg = _cfg()
    if not cfg["blob_conn_str"]:
        return ""
    try:
        from azure.storage.blob import BlobServiceClient, ContentSettings
    except ImportError:
        return ""

    blob_svc  = BlobServiceClient.from_connection_string(cfg["blob_conn_str"])
    container = cfg["blob_container"]
    loop      = asyncio.get_event_loop()

    def _upload():
        c = blob_svc.get_container_client(container)
        try:
            c.get_container_properties()
        except Exception:
            blob_svc.create_container(container)
        blob_name = f"persons/{person_id}/{filename}"
        blob      = c.get_blob_client(blob_name)
        blob.upload_blob(
            image_bytes, overwrite=True,
            content_settings=ContentSettings(content_type="image/jpeg"),
        )
        return blob.url

    return await run_in_executor_ctx(loop, _upload)


# ── Duplicate enrollment check ─────────────────────────────────────────────────

async def check_duplicate_face(
    image_bytes_list: list,
    similarity_threshold: float = None,
) -> dict | None:
    cfg       = _cfg()
    threshold = similarity_threshold if similarity_threshold is not None else cfg["dup_threshold"]
    loop      = asyncio.get_event_loop()
    _t0       = time.perf_counter()

    raw_store = _load_all()
    store = await raw_store if inspect.isawaitable(raw_store) else raw_store
    if not store:
        _log_timing("duplicate_check", _t0, photos=len(image_bytes_list), result="empty_store")
        return None

    def _check():
        fa    = _get_insight_app()

        all_pids, all_names, all_embs = [], [], []
        for pid, data in store.items():
            for emb in data["embeddings"]:
                all_pids.append(pid)
                all_names.append(data["name"])
                all_embs.append(emb)

        if not all_embs:
            _log_timing("duplicate_check", _t0, photos=len(image_bytes_list), result="empty_store")
            return None

        best_overall = None

        for photo_idx, img_bytes in enumerate(image_bytes_list):
            try:
                bgr   = _bytes_to_bgr(img_bytes)
                faces = fa.get(bgr)
                if not faces:
                    faces = fa.get(cv2.flip(bgr, 1))
                if not faces:
                    continue

                face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
                if float(face.det_score) < 0.40:
                    continue

                unknown_emb  = face.embedding
                similarities = [_cosine_similarity(unknown_emb, e) for e in all_embs]
                best_idx     = int(np.argmax(similarities))
                best_sim     = similarities[best_idx]

                logger.info(
                    "Duplicate check photo %d: best_match='%s' similarity=%.3f threshold=%.2f",
                    photo_idx+1, all_names[best_idx], best_sim, threshold,
                )

                if best_sim >= threshold:
                    candidate = {
                        "person_id":        all_pids[best_idx],
                        "name":             all_names[best_idx],
                        "confidence":       round(best_sim, 4),
                        "matched_on_photo": photo_idx + 1,
                    }
                    if best_overall is None or best_sim > best_overall["confidence"]:
                        best_overall = candidate

            except Exception as e:
                logger.warning("Duplicate check error on photo %d: %s", photo_idx+1, e)

        if best_overall:
            logger.warning(
                "Duplicate face detected! Matches '%s' (similarity=%.3f, photo=%d)",
                best_overall["name"], best_overall["confidence"],
                best_overall["matched_on_photo"],
            )
        _log_timing(
            "duplicate_check", _t0, photos=len(image_bytes_list),
            enrolled_embeddings=len(all_embs),
            result=("duplicate" if best_overall else "unique"),
        )
        return best_overall

    return await run_in_executor_ctx(loop, _check)


# ── Pre-enrollment image analysis ─────────────────────────────────────────────

async def analyze_enrollment_images(image_bytes_list: list) -> dict:
    loop = asyncio.get_event_loop()

    def _analyze():
        fa      = _get_insight_app()
        results = []

        for idx, img_bytes in enumerate(image_bytes_list):
            entry = {
                "photo":     idx + 1,
                "ok":        False,
                "det_score": None,
                "face_size": None,
                "reason":    "",
            }
            try:
                bgr   = _bytes_to_bgr(img_bytes)
                h, w  = bgr.shape[:2]
                faces = fa.get(bgr)
                if not faces:
                    faces = fa.get(cv2.flip(bgr, 1))

                if not faces:
                    entry["reason"] = (
                        "No face detected. Ensure your face is clearly visible and well-lit."
                    )
                    results.append(entry)
                    continue

                face   = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
                box    = face.bbox.astype(int)
                face_w = box[2] - box[0]
                face_h = box[3] - box[1]

                entry["det_score"] = round(float(face.det_score), 3)
                entry["face_size"] = [int(face_w), int(face_h)]

                ok, reason      = _check_face_quality(face, w, h)
                entry["ok"]     = ok
                entry["reason"] = reason

            except Exception as e:
                entry["reason"] = f"Processing error: {e}"

            results.append(entry)

        valid = sum(1 for r in results if r["ok"])
        return {
            "total":   len(results),
            "valid":   valid,
            "invalid": len(results) - valid,
            "results": results,
        }

    return await run_in_executor_ctx(loop, _analyze)
