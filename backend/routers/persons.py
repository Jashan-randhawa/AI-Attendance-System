"""
routers/persons.py - MongoDB version
"""

import logging
import os
import re
from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.database import get_db
from core.schemas import PersonOut
from core import azure_face

logger = logging.getLogger(__name__)
router = APIRouter()


def _doc_to_person(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("/debug-encodings", tags=["Debug"])
async def debug_encodings(db: AsyncIOMotorDatabase = Depends(get_db)):
    """
    Diagnostic: list persons whose face encodings are missing from MongoDB.
    These persons exist in the DB but CANNOT be recognized until re-enrolled.
    """
    import asyncio, logging
    from core import azure_face as af

    loop = asyncio.get_event_loop()
    enrolled_ids = await loop.run_in_executor(None, lambda: set(
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


@router.get("/debug-azure", tags=["Debug"])
async def debug_azure():
    key       = os.environ.get("AZURE_FACE_KEY", "")
    endpoint  = os.environ.get("AZURE_FACE_ENDPOINT", "")
    group_id  = os.environ.get("PERSON_GROUP_ID", "attendance-group")
    blob_conn = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")

    group_valid = bool(re.match(r'^[a-z0-9\-]{1,64}$', group_id))
    issues = []
    if not key:
        issues.append("AZURE_FACE_KEY is not set")
    if not endpoint:
        issues.append("AZURE_FACE_ENDPOINT is not set")
    elif not endpoint.startswith("https://"):
        issues.append(f"AZURE_FACE_ENDPOINT must start with https:// — got: {endpoint}")
    if not group_valid:
        issues.append(f"PERSON_GROUP_ID '{group_id}' is invalid")

    return {
        "status":          "ok" if not issues else "config_errors",
        "issues":          issues,
        "AZURE_FACE_KEY":  f"set ({len(key)} chars)" if key else "NOT SET ❌",
        "AZURE_FACE_ENDPOINT": endpoint or "NOT SET ❌",
        "PERSON_GROUP_ID": group_id,
        "PERSON_GROUP_ID_valid": group_valid,
        "AZURE_STORAGE_CONNECTION_STRING": "set" if blob_conn else "not set",
        "DUPLICATE_THRESHOLD": os.environ.get("DUPLICATE_THRESHOLD", "0.45 (default)"),
        "MIN_CONFIDENCE":      os.environ.get("MIN_CONFIDENCE", "0.40 (default)"),
    }


@router.get("", response_model=List[PersonOut])
async def list_persons(db: AsyncIOMotorDatabase = Depends(get_db)):
    docs = []
    async for doc in db.persons.find({"is_active": True}).sort("name", 1):
        docs.append(PersonOut(**_doc_to_person(doc)))
    return docs


@router.post("/enroll/analyze")
async def analyze_photos(photos: List[UploadFile] = File(...)):
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
        if not photo.content_type.startswith("image/"):
            raise HTTPException(400, f"File '{photo.filename}' is not an image.")
        image_bytes_list.append(await photo.read())

    try:
        await azure_face.ensure_person_group()
    except Exception as e:
        raise HTTPException(503, f"Face analysis service unavailable: {e}")

    try:
        report = await azure_face.analyze_enrollment_images(image_bytes_list)
    except Exception as e:
        logger.error("Image analysis failed: %s", e)
        raise HTTPException(503, f"Image analysis failed: {e}")

    return report


@router.post("/enroll", response_model=PersonOut, status_code=status.HTTP_201_CREATED)
async def enroll_person(
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
        if not photo.content_type.startswith("image/"):
            raise HTTPException(400, f"File '{photo.filename}' is not an image.")
        image_bytes_list.append(await photo.read())

    try:
        await azure_face.ensure_person_group()
    except Exception as e:
        logger.error("InsightFace setup failed: %s", e)
        raise HTTPException(503, f"Face service setup error: {e}")

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
    except Exception as e:
        # The check itself failed — we must BLOCK enrollment, not allow it.
        # Allowing enrollment when we can't verify uniqueness defeats the
        # entire purpose of the duplicate check.
        logger.error("Duplicate face check error (blocking enrollment): %s", e)
        raise HTTPException(
            503,
            f"Could not verify face uniqueness: {e}. "
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
        raise HTTPException(422, str(e))
    except Exception as e:
        logger.error("Enrollment error: %s", e)
        raise HTTPException(503, f"Enrollment failed: {e}")

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
        "enrolled_at": datetime.utcnow(),
        "is_active":   True,
    }
    await db.persons.insert_one(person_doc)
    return PersonOut(**_doc_to_person(person_doc))


@router.get("/{person_id}", response_model=PersonOut)
async def get_person(person_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db.persons.find_one({"_id": person_id})
    if not doc:
        raise HTTPException(404, "Person not found.")
    return PersonOut(**_doc_to_person(doc))


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_person(person_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db.persons.find_one({"_id": person_id})
    if not doc:
        raise HTTPException(404, "Person not found.")
    try:
        await azure_face.delete_person(person_id)
    except Exception as e:
        logger.error("Azure delete error: %s", e)
        raise HTTPException(503, f"Delete failed: {e}")
    await db.persons.update_one({"_id": person_id}, {"$set": {"is_active": False}})
