"""
routers/attendance.py - MongoDB version
"""

import csv
import io
import logging
from datetime import date, datetime, timedelta
from typing import List, Optional
from bson import ObjectId

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.database import get_db, person_already_marked, get_person_by_azure_id
from core.schemas import AttendanceOut, MarkAttendanceResponse, IdentifyResult
from core import azure_face

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/identify", response_model=List[IdentifyResult])
async def identify_frame(
    frame:      UploadFile = File(...),
    confidence: float      = Query(0.40, ge=0.1, le=1.0),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not frame.content_type.startswith("image/"):
        raise HTTPException(400, "Uploaded file must be an image.")
    image_bytes = await frame.read()
    try:
        results = await azure_face.identify_faces(image_bytes, confidence)
    except Exception as e:
        logger.error("Azure identify error: %s", e)
        raise HTTPException(503, f"Azure Face API error: {e}")
    return [IdentifyResult(**r) for r in results]


@router.post("/mark/{session_id}", response_model=MarkAttendanceResponse)
async def mark_attendance(
    session_id: str,
    frame:      UploadFile = File(...),
    confidence: float      = Query(0.40, ge=0.1, le=1.0),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    session = await db.sessions.find_one({"_id": ObjectId(session_id), "is_active": True})
    if not session:
        raise HTTPException(404, "Active session not found.")

    if not frame.content_type.startswith("image/"):
        raise HTTPException(400, "Uploaded file must be an image.")

    image_bytes = await frame.read()
    try:
        raw_results = await azure_face.identify_faces(image_bytes, confidence)
    except Exception as e:
        logger.error("Azure error: %s", e)
        raise HTTPException(503, f"Azure Face API error: {e}")

    identified: List[IdentifyResult] = []
    new_records = 0

    for r in raw_results:
        person = await get_person_by_azure_id(db, r["azure_person_id"])
        if not person:
            logger.warning("Azure person %s not in DB — skipping.", r["azure_person_id"])
            continue

        already = await person_already_marked(db, person["_id"], session_id)

        if not already:
            try:
                await db.attendance.insert_one({
                    "person_id":  person["_id"],
                    "session_id": session_id,
                    "marked_at":  datetime.utcnow(),
                    "confidence": r["confidence"],
                    "status":     "present",
                })
                new_records += 1
            except Exception:
                pass  # duplicate key — already marked

        identified.append(IdentifyResult(
            azure_person_id=r["azure_person_id"],
            name=r["name"],
            confidence=r["confidence"],
            face_box=r["face_box"],
            already_marked=already,
        ))

    return MarkAttendanceResponse(
        session_id=session_id,
        identified=identified,
        new_records=new_records,
    )


@router.get("", response_model=List[AttendanceOut])
async def list_attendance(
    session_id:    Optional[str]  = Query(None),
    person_id:     Optional[str]  = Query(None),
    date_filter:   Optional[date] = Query(None, alias="date"),
    status_filter: Optional[str]  = Query(None, alias="status"),
    limit:         int            = Query(200, le=1000),
    db: AsyncIOMotorDatabase      = Depends(get_db),
):
    match: dict = {}
    if session_id:
        match["session_id"] = session_id
    if person_id:
        match["person_id"] = person_id
    if date_filter:
        day_start = datetime.combine(date_filter, datetime.min.time())
        day_end   = day_start + timedelta(days=1)
        match["marked_at"] = {"$gte": day_start, "$lt": day_end}
    if status_filter:
        match["status"] = status_filter

    pipeline = [
        {"$match": match},
        {"$sort": {"marked_at": -1}},
        {"$limit": limit},
        # persons._id is a string UUID — direct match works
        {"$lookup": {"from": "persons", "localField": "person_id", "foreignField": "_id", "as": "person"}},
        # sessions._id is an ObjectId but attendance.session_id is stored as a string,
        # so we must convert _id to string before comparing.
        {"$lookup": {
            "from": "sessions",
            "let": {"sid": "$session_id"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": [{"$toString": "$_id"}, "$$sid"]}}}
            ],
            "as": "session",
        }},
        {"$unwind": "$person"},
        {"$unwind": "$session"},
    ]

    rows = []
    async for doc in db.attendance.aggregate(pipeline):
        rows.append(AttendanceOut(
            id=str(doc["_id"]),
            person_id=doc["person_id"],
            person_name=doc["person"]["name"],
            department=doc["person"].get("department"),
            session_id=str(doc["session_id"]),
            session_label=doc["session"]["label"],
            marked_at=doc["marked_at"],
            confidence=doc.get("confidence"),
            status=doc["status"],
        ))
    return rows


@router.get("/export/csv")
async def export_csv(
    session_id:  Optional[str]  = Query(None),
    date_filter: Optional[date] = Query(None, alias="date"),
    db: AsyncIOMotorDatabase     = Depends(get_db),
):
    records = await list_attendance(
        session_id=session_id, person_id=None,
        date_filter=date_filter, status_filter=None,
        limit=10000, db=db,
    )
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "id", "person_name", "department", "session_label",
        "marked_at", "confidence", "status"
    ])
    writer.writeheader()
    for r in records:
        writer.writerow({
            "id":            r.id,
            "person_name":   r.person_name,
            "department":    r.department or "",
            "session_label": r.session_label,
            "marked_at":     r.marked_at.isoformat(),
            "confidence":    r.confidence or "",
            "status":        r.status,
        })
    output.seek(0)
    filename = f"attendance_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
