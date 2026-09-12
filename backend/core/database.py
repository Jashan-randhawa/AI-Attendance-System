"""
core/database.py
Async MongoDB setup using Motor.
Collections: persons, sessions, attendance
"""

import os
import logging
from datetime import datetime, date, timedelta
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, TEXT
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME   = os.getenv("MONGODB_DB_NAME", "attendance_db")

_client: Optional[AsyncIOMotorClient] = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(
            MONGO_URL,
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=30000,
            socketTimeoutMS=30000,
            tls=True,
            tlsAllowInvalidCertificates=False,
        )
    return _client


def get_database() -> AsyncIOMotorDatabase:
    return get_client()[DB_NAME]


async def get_db() -> AsyncIOMotorDatabase:
    return get_database()


async def init_db() -> None:
    db = get_database()

    await db.command("ping")
    logger.info("MongoDB connection successful!")

    # ── persons indexes ───────────────────────────────────────────────────────
    await db.persons.create_index([("name", ASCENDING)])
    await db.persons.create_index([("is_active", ASCENDING)])

    # Case-insensitive unique index on name for active persons.
    # This is the DB-level safety net that prevents duplicate names even if
    # the application-level check is somehow bypassed (race condition, direct
    # API call, etc.).  We use a partial filter so soft-deleted records
    # (is_active: false) don't block re-enrollment after deletion.
    try:
        await db.persons.create_index(
            [("name", TEXT)],
            name="name_unique_active",
            partialFilterExpression={"is_active": True},
            unique=True,
            default_language="none",  # disable stemming so "Ali" != "Ali's"
        )
    except Exception as e:
        # Index may already exist with different options on an existing DB —
        # log and continue rather than crashing startup.
        logger.warning("Could not create unique name index (may already exist): %s", e)

    # ── sessions indexes ──────────────────────────────────────────────────────
    await db.sessions.create_index([("is_active", ASCENDING)])
    await db.sessions.create_index([("started_at", DESCENDING)])

    # ── attendance — compound unique prevents double-marking ─────────────────
    await db.attendance.create_index(
        [("person_id", ASCENDING), ("session_id", ASCENDING)], unique=True
    )
    await db.attendance.create_index([("marked_at", DESCENDING)])
    await db.attendance.create_index([("status", ASCENDING)])

    logger.info("MongoDB indexes created on '%s'", DB_NAME)


async def get_person_by_azure_id(db: AsyncIOMotorDatabase, azure_id: str) -> Optional[dict]:
    return await db.persons.find_one({"_id": azure_id, "is_active": True})


async def person_already_marked(db: AsyncIOMotorDatabase, person_id: str, session_id: str) -> bool:
    doc = await db.attendance.find_one({"person_id": person_id, "session_id": session_id})
    return doc is not None


async def count_persons(db: AsyncIOMotorDatabase) -> int:
    return await db.persons.count_documents({"is_active": True})


async def count_sessions_today(db: AsyncIOMotorDatabase) -> int:
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end   = today_start + timedelta(days=1)
    return await db.sessions.count_documents({
        "started_at": {"$gte": today_start, "$lt": today_end}
    })


async def count_present_today(db: AsyncIOMotorDatabase) -> int:
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end   = today_start + timedelta(days=1)
    return await db.attendance.count_documents({
        "marked_at": {"$gte": today_start, "$lt": today_end},
        "status": "present",
    })


async def get_recent_activity(db: AsyncIOMotorDatabase, limit: int = 8) -> list:
    pipeline = [
        {"$sort": {"marked_at": -1}},
        {"$limit": limit},
        {"$lookup": {"from": "persons", "localField": "person_id", "foreignField": "_id", "as": "person"}},
        # sessions._id is ObjectId but attendance.session_id is stored as string — use $toString
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
        {"$project": {
            "id":            {"$toString": "$_id"},
            "person_name":   "$person.name",
            "department":    "$person.department",
            "session_label": "$session.label",
            "marked_at":     {"$dateToString": {"format": "%Y-%m-%dT%H:%M:%S", "date": "$marked_at"}},
            "confidence":    1,
            "status":        1,
        }},
    ]
    rows = []
    async for doc in db.attendance.aggregate(pipeline):
        rows.append(doc)
    return rows
