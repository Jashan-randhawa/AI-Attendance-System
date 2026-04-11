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
import uuid
import asyncio
import logging

import cv2
import numpy as np
from PIL import Image
import pymongo

logger = logging.getLogger(__name__)

# ── InsightFace model (lazy singleton) ────────────────────────────────────────

_app = None

def _get_insight_app():
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


# ── Synchronous MongoDB client (used inside thread executors) ─────────────────

_sync_client = None
_sync_col    = None   # face_encodings collection

def _get_col():
    """Return a pymongo Collection for face_encodings, creating it if needed."""
    global _sync_client, _sync_col
    if _sync_col is None:
        mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
        db_name   = os.environ.get("MONGODB_DB_NAME", "attendance_db")
        _sync_client = pymongo.MongoClient(
            mongo_url,
            serverSelectionTimeoutMS=30_000,
            connectTimeoutMS=30_000,
            socketTimeoutMS=30_000,
            tls=True,
            tlsAllowInvalidCertificates=False,
        )
        db = _sync_client[db_name]
        db["face_encodings"].create_index("name")
        _sync_col = db["face_encodings"]
        logger.info("Synchronous MongoDB client ready for face_encodings.")
    return _sync_col


# ── Persistence helpers (MongoDB-backed) ──────────────────────────────────────

def _load_all() -> dict:
    """Returns {person_id: {"name": str, "embeddings": [np.ndarray, ...]}}"""
    col   = _get_col()
    store = {}
    for doc in col.find():
        pid = doc["_id"]
        store[pid] = {
            "name":       doc["name"],
            "embeddings": [np.array(e, dtype=np.float32) for e in doc["embeddings"]],
        }
    return store


def _upsert_person(person_id: str, name: str, embeddings: list) -> None:
    col = _get_col()
    col.update_one(
        {"_id": person_id},
        {"$set": {
            "name":       name,
            "embeddings": [e.tolist() for e in embeddings],
        }},
        upsert=True,
    )


def _delete_person_doc(person_id: str) -> None:
    _get_col().delete_one({"_id": person_id})


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
    await loop.run_in_executor(None, _get_insight_app)
    await loop.run_in_executor(None, _get_col)          # warm up MongoDB
    logger.info("InsightFace backend ready.")


async def train_person_group() -> None:
    pass


async def enroll_person(name: str, image_bytes_list: list) -> str:
    loop = asyncio.get_event_loop()

    def _encode_all():
        fa             = _get_insight_app()
        person_id      = str(uuid.uuid4())
        new_embeddings = []
        quality_errors = []

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

        # Persist to MongoDB — survives restarts
        _upsert_person(person_id, name, new_embeddings)
        logger.info("Enrolled '%s' with %d embedding(s) in MongoDB. id=%s",
                    name, len(new_embeddings), person_id)
        return person_id

    return await loop.run_in_executor(None, _encode_all)


async def delete_person(azure_person_id: str) -> None:
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _delete_person_doc, azure_person_id)


async def identify_faces(image_bytes: bytes, confidence_threshold: float = None) -> list:
    cfg  = _cfg()
    loop = asyncio.get_event_loop()

    def _identify():
        fa    = _get_insight_app()
        store = _load_all()
        if not store:
            logger.info("No enrolled persons in MongoDB face_encodings.")
            return []

        bgr   = _bytes_to_bgr(image_bytes)
        faces = fa.get(bgr)
        if not faces:
            bright = cv2.convertScaleAbs(bgr, alpha=1.3, beta=30)
            faces  = fa.get(bright)
        if not faces:
            logger.info("No faces detected in frame.")
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

        return results

    return await loop.run_in_executor(None, _identify)


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

    return await loop.run_in_executor(None, _upload)


# ── Duplicate enrollment check ─────────────────────────────────────────────────

async def check_duplicate_face(
    image_bytes_list: list,
    similarity_threshold: float = None,
) -> dict | None:
    cfg       = _cfg()
    threshold = similarity_threshold if similarity_threshold is not None else cfg["dup_threshold"]
    loop      = asyncio.get_event_loop()

    def _check():
        fa    = _get_insight_app()
        store = _load_all()
        if not store:
            return None

        all_pids, all_names, all_embs = [], [], []
        for pid, data in store.items():
            for emb in data["embeddings"]:
                all_pids.append(pid)
                all_names.append(data["name"])
                all_embs.append(emb)

        if not all_embs:
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
        return best_overall

    return await loop.run_in_executor(None, _check)


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

    return await loop.run_in_executor(None, _analyze)
