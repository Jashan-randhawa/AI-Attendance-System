"""
routers/sessions.py - MongoDB version
"""

from datetime import datetime, UTC
from typing import List, Optional
from bson import ObjectId
from bson.errors import InvalidId

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.database import get_db
from core.schemas import SessionCreate, SessionOut
from core.auth import require_operator

router = APIRouter()


def _doc_to_session(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def _parse_object_id(session_id: str) -> ObjectId:
    """
    Safely parse a session_id path param into an ObjectId.

    Phase 0 fix: previously `ObjectId(session_id)` was called directly at
    each call site. A malformed ID (typo, bot probe, stale frontend cache)
    raised an uncaught bson.errors.InvalidId, which FastAPI turned into an
    unhandled 500 instead of a clean, informative 4xx.
    """
    try:
        return ObjectId(session_id)
    except (InvalidId, TypeError):
        raise HTTPException(400, f"Invalid session_id format: '{session_id}'.")


@router.get("", response_model=List[SessionOut], dependencies=[Depends(require_operator)])
async def list_sessions(
    active: Optional[bool] = Query(None),
    limit:  int            = Query(50, le=200),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    query = {}
    if active is not None:
        query["is_active"] = active
    docs = []
    async for doc in db.sessions.find(query).sort("started_at", -1).limit(limit):
        docs.append(SessionOut(**_doc_to_session(doc)))
    return docs


@router.post(
    "",
    response_model=SessionOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_operator)],
)
async def create_session(
    body: SessionCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = {
        "label":      body.label,
        "department": body.department,
        "started_at": datetime.now(UTC),
        "ended_at":   None,
        "is_active":  True,
    }
    result = await db.sessions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return SessionOut(**_doc_to_session(doc))


@router.get("/{session_id}", response_model=SessionOut, dependencies=[Depends(require_operator)])
async def get_session(session_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    oid = _parse_object_id(session_id)
    doc = await db.sessions.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Session not found.")
    return SessionOut(**_doc_to_session(doc))


@router.patch(
    "/{session_id}/end",
    response_model=SessionOut,
    dependencies=[Depends(require_operator)],
)
async def end_session(session_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    oid = _parse_object_id(session_id)
    doc = await db.sessions.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Session not found.")
    if not doc.get("is_active"):
        raise HTTPException(400, "Session is already closed.")
    now = datetime.now(UTC)
    await db.sessions.update_one(
        {"_id": oid},
        {"$set": {"ended_at": now, "is_active": False}},
    )
    doc["ended_at"]  = now
    doc["is_active"] = False
    return SessionOut(**_doc_to_session(doc))
