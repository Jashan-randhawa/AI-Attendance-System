"""
routers/persons.py - MongoDB version
"""

import logging
import os
import re
from typing import List
from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.database import get_db
from core.schemas import PersonOut
from core import azure_face
from core.auth import require_admin
from core.rate_limit import limiter
from core.validation import read_and_validate_image

logger = logging.getLogger(__name__)
router = APIRouter()


def _doc_to_person(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("/debug-encodings", tags=["Debug"], dependencies=[Depends(require_admin)])
async def debug_encodings(db: AsyncIOMotorDatabase = Depends(get_db)):
    """
    Diagnostic: list persons whose face encodings are missing from MongoDB.
    These persons exist in the DB but CANNOT be recognized until re-enrolled.
    """
    import asyncio, logging
    from core import azure_face as af
    from core.logging_context import run_in_executor_ctx

    loop = asyncio.get_event_loop()
    enrolled_ids = await run_in_executor_ctx(loop, lambda: set(
        doc["_id"] for doc in af._get_col().find({}, {"_id": 1})
    ))

    missing = []
    async for person in db.persons.find({"is_active": True}):
        pid = person["_id"]
        if pid not in enrolled_ids:
            missing.append({
                "person_id": pid,
                "name":      person["name"],
                "enrolled_at": str(person.get("enrolled_at", "unknown")),
                "action_needed": "Delete this person and re-enroll with photos",
            })

    return {
        "total_active_persons":       await db.persons.count_documents({"is_active": True}),
        "persons_with_encodings":     len(enrolled_ids),
        "persons_missing_encodings":  len(missing),
        "missing":                    missing,
    }


@router.get("/debug-config", tags=["Debug"], dependencies=[Depends(require_admin)])
async def debug_config():
    """
    Diagnostic: validate the environment variables the InsightFace + MongoDB
    pipeline actually reads.

    Replaces the old `/debug-azure` endpoint, which checked AZURE_FACE_KEY /
    AZURE_FACE_ENDPOINT / PERSON_GROUP_ID — leftovers from an earlier Azure
    Face API implementation that this codebase no longer uses. That endpoint
    always reported "NOT SET" regardless of real health, which is actively
    misleading during an incident. This checks the real dependencies instead:
    MongoDB connection string, and the confidence/duplicate thresholds.
    Azure Blob Storage is optional (photo hosting only) and is reported but
    not treated as an error if absent.
    """
    mongo_url  = os.environ.get("MONGODB_URL", "")
    db_name    = os.environ.get("MONGODB_DB_NAME", "attendance_db")
    blob_conn  = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "").strip()
    min_conf   = os.environ.get("MIN_CONFIDENCE", "0.40")
    dup_thresh = os.environ.get("DUPLICATE_THRESHOLD", "0.45")

    issues = []
    if not mongo_url:
        issues.append(
            "MONGODB_URL is not set — falling back to mongodb://localhost:27017. "
            "Face encodings and persons will NOT survive a redeploy."
        )
    try:
        if float(dup_thresh) < float(min_conf):
            issues.append(
                f"DUPLICATE_THRESHOLD ({dup_thresh}) is lower than MIN_CONFIDENCE "
                f"({min_conf}) — duplicate detection will be stricter than live "
                "recognition, which is usually not intended."
            )
    except ValueError:
        issues.append("MIN_CONFIDENCE or DUPLICATE_THRESHOLD is not a valid float.")

    return {
        "status":                 "ok" if not issues else "config_warnings",
        "issues":                 issues,
        "MONGODB_URL":            "set" if mongo_url else "NOT SET ❌ (using localhost fallback)",
        "MONGODB_DB_NAME":        db_name,
        "AZURE_STORAGE_CONNECTION_STRING": "set (optional)" if blob_conn else "not set (optional — photo hosting only)",
        "MIN_CONFIDENCE":         min_conf,
        "DUPLICATE_THRESHOLD":    dup_thresh,
        "API_KEY_ADMIN_configured":    bool(os.environ.get("API_KEY_ADMIN", "").strip()),
        "API_KEY_OPERATOR_configured": bool(os.environ.get("API_KEY_OPERATOR", "").strip()),
        "API_KEY_legacy_configured":   bool(os.environ.get("API_KEY", "").strip()),
    }


@router.get("", response_model=List[PersonOut], dependencies=[Depends(require_admin)])
async def list_persons(db: AsyncIOMotorDatabase = Depends(get_db)):
    docs = []
    async for doc in db.persons.find({"is_active": True}).sort("name", 1):
        docs.append(PersonOut(**_doc_to_person(doc)))
    return docs


@router.post("/enroll/analyze", dependencies=[Depends(require_admin)])
@limiter.limit("10/minute")
async def analyze_photos(request: Request, photos: List[UploadFile] = File(...)):
    """
    Pre-enrollment image quality check — call before submitting the enroll form.
    Returns per-photo quality feedback without enrolling anyone.
    """
    if not photos:
        raise HTTPException(400, "No photos provided.")
    if len(photos) > 10:
        raise HTTPException(400, "Maximum 10 photos allowed.")

    image_bytes_list = []
    for photo in photos:
        image_bytes_list.append(await read_and_validate_image(photo))

    try:
        await azure_face.ensure_person_group()
    except Exception:
        logger.exception("Face analysis service setup failed")
        raise HTTPException(503, "Face analysis service temporarily unavailable.")

    try:
        report = await azure_face.analyze_enrollment_images(image_bytes_list)
    except Exception:
        logger.exception("Image analysis failed")
        raise HTTPException(503, "Image analysis service temporarily unavailable.")

    return report


@router.post(
    "/enroll",
    response_model=PersonOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
@limiter.limit("10/minute")
async def enroll_person(
    request:    Request,
    name:       str              = Form(...),
    email:      str              = Form(None),
    department: str              = Form(None),
    photos:     List[UploadFile] = File(...),
    db: AsyncIOMotorDatabase     = Depends(get_db),
):
    if len(photos) < 1:
        raise HTTPException(400, "At least 1 photo is required.")
    if len(photos) > 10:
        raise HTTPException(400, "Maximum 10 photos allowed.")

    image_bytes_list = []
    for photo in photos:
        image_bytes_list.append(await read_and_validate_image(photo))

    try:
        await azure_face.ensure_person_group()
    except Exception:
        logger.exception("InsightFace setup failed")
        raise HTTPException(503, "Face service setup error. Please try again.")

    # ── 1. Name-level duplicate check (fast DB check before face analysis) ──
    # Catches the most common case: operator accidentally submits the same
    # person twice with the same name.
    existing_name = await db.persons.find_one(
        {"name": {"$regex": f"^{re.escape(name.strip())}$", "$options": "i"}, "is_active": True}
    )
    if existing_name:
        raise HTTPException(
            409,
            f"A person named '{existing_name['name']}' is already enrolled "
            f"(enrolled {existing_name.get('enrolled_at', 'unknown date')}). "
            "Use a different name or delete the existing record first."
        )

    # ── 2. Face-level duplicate check (FATAL — never silently skip) ──────────
    # Previously this was non-fatal: any exception would be swallowed and
    # enrollment would proceed. Now any failure here aborts enrollment.
    try:
        duplicate = await azure_face.check_duplicate_face(image_bytes_list)
    except Exception:
        # The check itself failed — we must BLOCK enrollment, not allow it.
        # Allowing enrollment when we can't verify uniqueness defeats the
        # entire purpose of the duplicate check.
        logger.exception("Duplicate face check error (blocking enrollment)")
        raise HTTPException(
            503,
            "Could not verify face uniqueness. "
            "Please try again. If the problem persists, check server logs."
        )

    if duplicate:
        raise HTTPException(
            409,
            f"This face is already enrolled as '{duplicate['name']}' "
            f"(similarity: {duplicate['confidence']*100:.1f}% matched on photo {duplicate['matched_on_photo']}). "
            "Delete the existing record first if you want to re-enroll."
        )

    # ── 3. Enroll (includes per-photo quality gate inside azure_face) ────────
    try:
        azure_id = await azure_face.enroll_person(name, image_bytes_list)
    except ValueError as e:
        # Deliberate, application-generated validation message (e.g. "no
        # face detected in photo 2") — safe to show as-is, not an internal
        # exception leak.
        raise HTTPException(422, str(e))
    except Exception:
        logger.exception("Enrollment failed")
        raise HTTPException(503, "Enrollment service temporarily unavailable.")

    photo_url = ""
    try:
        photo_url = await azure_face.upload_photo_to_blob(
            azure_id, image_bytes_list[0], photos[0].filename or "photo.jpg"
        )
    except Exception as e:
        logger.warning("Blob upload failed (non-critical): %s", e)

    person_doc = {
        "_id":         azure_id,
        "name":        name.strip(),
        "email":       email,
        "department":  department,
        "photo_url":   photo_url or None,
        "enrolled_at": datetime.now(UTC),
        "is_active":   True,
    }
    try:
        await db.persons.insert_one(person_doc)
    except Exception as e:
        logger.error("Person insert failed after embedding was written — rolling back: %s", e)
        try:
            await azure_face.delete_person(azure_id)
        except Exception as cleanup_err:
            logger.critical(
                "Rollback FAILED — orphaned embedding for azure_id=%s: %s",
                azure_id, cleanup_err,
            )
        raise HTTPException(503, "Enrollment could not be completed. Please try again.")
    return PersonOut(**_doc_to_person(person_doc))


@router.get("/{person_id}", response_model=PersonOut, dependencies=[Depends(require_admin)])
async def get_person(person_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db.persons.find_one({"_id": person_id})
    if not doc:
        raise HTTPException(404, "Person not found.")
    return PersonOut(**_doc_to_person(doc))


@router.delete(
    "/{person_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
async def delete_person(person_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db.persons.find_one({"_id": person_id})
    if not doc:
        raise HTTPException(404, "Person not found.")
    try:
        await azure_face.delete_person(person_id)
    except Exception:
        logger.exception("Azure delete error")
        raise HTTPException(503, "Delete failed. Please try again.")
    await db.persons.update_one({"_id": person_id}, {"$set": {"is_active": False}})
