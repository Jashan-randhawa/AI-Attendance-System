"""
routers/sessions.py - MongoDB version
"""

from datetime import datetime
from typing import List, Optional
from bson import ObjectId

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.database import get_db
from core.schemas import SessionCreate, SessionOut

router = APIRouter()


def _doc_to_session(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("", response_model=List[SessionOut])
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


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: SessionCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = {
        "label":      body.label,
        "department": body.department,
        "started_at": datetime.utcnow(),
        "ended_at":   None,
        "is_active":  True,
    }
    result = await db.sessions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return SessionOut(**_doc_to_session(doc))


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(session_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not doc:
        raise HTTPException(404, "Session not found.")
    return SessionOut(**_doc_to_session(doc))


@router.patch("/{session_id}/end", response_model=SessionOut)
async def end_session(session_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    doc = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not doc:
        raise HTTPException(404, "Session not found.")
    if not doc.get("is_active"):
        raise HTTPException(400, "Session is already closed.")
    now = datetime.utcnow()
    await db.sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"ended_at": now, "is_active": False}},
    )
    doc["ended_at"]  = now
    doc["is_active"] = False
    return SessionOut(**_doc_to_session(doc))
