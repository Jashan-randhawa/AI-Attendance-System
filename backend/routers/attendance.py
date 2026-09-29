"""
routers/attendance.py - MongoDB version
"""

import csv
import io
import logging
from datetime import date, datetime, timedelta, UTC
from typing import List, Optional
from bson import ObjectId
from bson.errors import InvalidId
from pymongo.errors import DuplicateKeyError

import base64
from fastapi import (
    APIRouter, Depends, HTTPException, Request, UploadFile, File, Query, status,
    WebSocket, WebSocketDisconnect,
)
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.database import get_db, get_database, person_already_marked, get_person_by_azure_id
from core.schemas import AttendanceOut, MarkAttendanceResponse, IdentifyResult
from core import azure_face
from core.auth import require_operator, require_admin, get_user_id_from_request
from core.rate_limit import limiter
from core.validation import read_and_validate_image
from core.audit import record_audit_event
from core.metrics import record_attendance_mark

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/identify",
    response_model=List[IdentifyResult],
    dependencies=[Depends(require_operator)],
)
@limiter.limit("20/minute")
async def identify_frame(
    request:    Request,
    frame:      UploadFile = File(...),
    confidence: float      = Query(0.40, ge=0.1, le=1.0),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    image_bytes = await read_and_validate_image(frame)
    try:
        results = await azure_face.identify_faces(image_bytes, confidence)
    except Exception:
        logger.exception("Identify error")
        raise HTTPException(503, "Face recognition service temporarily unavailable.")
    return [IdentifyResult(**r) for r in results]


@router.post(
    "/mark/{session_id}",
    response_model=MarkAttendanceResponse,
    dependencies=[Depends(require_operator)],
)
@limiter.limit("20/minute")
async def mark_attendance(
    request:    Request,
    session_id: str,
    frame:      UploadFile = File(...),
    confidence: float      = Query(0.40, ge=0.1, le=1.0),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    try:
        session_oid = ObjectId(session_id)
    except (InvalidId, TypeError):
        raise HTTPException(400, f"Invalid session_id format: '{session_id}'.")

    session = await db.sessions.find_one({"_id": session_oid, "is_active": True})
    if not session:
        raise HTTPException(404, "Active session not found.")

    image_bytes = await read_and_validate_image(frame)
    try:
        raw_results = await azure_face.identify_faces(image_bytes, confidence)
    except Exception:
        logger.exception("Identify error during mark")
        raise HTTPException(503, "Face recognition service temporarily unavailable.")

    identified: List[IdentifyResult] = []
    new_records = 0

    for r in raw_results:
        person = await get_person_by_azure_id(db, r["azure_person_id"])
        if not person:
            logger.warning("Azure person %s not in DB — skipping.", r["azure_person_id"])
            continue

        already = await person_already_marked(db, person["_id"], session_oid)

        if not already:
            try:
                user_id = get_user_id_from_request(request)
                att_doc = {
                    "person_id":  person["_id"],
                    "session_id": session_oid,
                    "marked_at":  datetime.now(UTC),
                    "confidence": r["confidence"],
                    "status":     "present",
                }
                if user_id:
                    att_doc["marked_by"] = user_id
                await db.attendance.insert_one(att_doc)
                new_records += 1
                record_attendance_mark("new")
                await record_audit_event(
                    action="MARK_ATTENDANCE",
                    actor_id=user_id or "operator",
                    actor_role="operator",
                    ip_address=request.client.host if request.client else "unknown",
                    target_id=str(person["_id"]),
                    metadata={"session_id": session_id, "confidence": r["confidence"]},
                )
            except DuplicateKeyError:
                record_attendance_mark("duplicate")
                logger.info(
                    "Duplicate attendance mark ignored for person=%s session=%s",
                    person["_id"], session_id,
                )
        else:
            record_attendance_mark("duplicate")

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


@router.get("", response_model=List[AttendanceOut], dependencies=[Depends(require_operator)])
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
        try:
            match["session_id"] = ObjectId(session_id)
        except (InvalidId, TypeError):
            raise HTTPException(400, f"Invalid session_id format: '{session_id}'.")
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
        # sessions._id is an ObjectId and attendance.session_id is stored as ObjectId
        {"$lookup": {"from": "sessions", "localField": "session_id", "foreignField": "_id", "as": "session"}},
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
            marked_by=doc.get("marked_by"),
        ))
    return rows


@router.get("/export/csv", dependencies=[Depends(require_admin)])
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


# ── Real-Time Streaming WebSocket ─────────────────────────────────────────────

@router.websocket("/ws/{session_id}")
async def attendance_websocket(
    websocket: WebSocket,
    session_id: str,
):
    """
    Real-time persistent bi-directional streaming endpoint for camera feeds.
    Accepts raw binary JPEG/WebP frames or base64 data URLs.
    Returns recognition bounding boxes and match status without HTTP overhead.
    """
    await websocket.accept()
    db = get_database()
    try:
        session_oid = ObjectId(session_id)
        session = await db.sessions.find_one({"_id": session_oid, "is_active": True})
        if not session:
            await websocket.send_json({"error": "Active session not found", "status": 404})
            await websocket.close()
            return
    except Exception:
        await websocket.send_json({"error": "Invalid session identifier", "status": 400})
        await websocket.close()
        return

    try:
        while True:
            data = await websocket.receive()
            image_bytes = None
            if "bytes" in data and data["bytes"]:
                image_bytes = data["bytes"]
            elif "text" in data and data["text"]:
                raw_text = data["text"].strip()
                if "," in raw_text:
                    raw_text = raw_text.split(",", 1)[1]
                image_bytes = base64.b64decode(raw_text)

            if not image_bytes:
                continue

            results = await azure_face.identify_faces(image_bytes)
            await websocket.send_json({
                "timestamp": datetime.now(UTC).isoformat(),
                "session_id": session_id,
                "matches": results,
                "faces_detected": len(results),
            })
    except WebSocketDisconnect:
        logger.info("Live WebSocket stream disconnected for session %s", session_id)
    except Exception as e:
        logger.warning("WebSocket live stream exception: %s", e)
        try:
            await websocket.close()
        except Exception:
            pass
