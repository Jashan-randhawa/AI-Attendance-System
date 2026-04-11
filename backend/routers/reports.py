"""
routers/reports.py - MongoDB version
"""

from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.database import get_db
from core.schemas import DailyAttendanceStat, PersonAttendanceStat

router = APIRouter()


@router.get("/daily", response_model=List[DailyAttendanceStat])
async def daily_stats(
    days: int = Query(30, ge=1, le=365),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    since = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())

    # Present counts per day
    pipeline = [
        {"$match": {"marked_at": {"$gte": since}, "status": "present"}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$marked_at"}},
            "present": {"$addToSet": "$person_id"},
        }},
    ]
    present_map = {}
    async for doc in db.attendance.aggregate(pipeline):
        present_map[doc["_id"]] = len(doc["present"])

    # Sessions per day
    sess_pipeline = [
        {"$match": {"started_at": {"$gte": since}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$started_at"}},
            "count": {"$sum": 1},
        }},
    ]
    session_map = {}
    async for doc in db.sessions.aggregate(sess_pipeline):
        session_map[doc["_id"]] = doc["count"]

    total_enrolled = await db.persons.count_documents({"is_active": True}) or 1

    stats = []
    for i in range(days):
        d = (date.today() - timedelta(days=days - i - 1)).isoformat()
        present = present_map.get(d, 0)
        rate = round((present / total_enrolled) * 100, 1)
        stats.append(DailyAttendanceStat(
            date=d,
            total_sessions=session_map.get(d, 0),
            total_present=present,
            attendance_rate=rate,
        ))
    return stats


@router.get("/persons", response_model=List[PersonAttendanceStat])
async def person_stats(
    days: int = Query(30, ge=1, le=365),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    since = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())

    total_sessions = await db.sessions.count_documents({"started_at": {"$gte": since}}) or 1

    pipeline = [
        {"$match": {"marked_at": {"$gte": since}, "status": "present"}},
        {"$group": {"_id": "$person_id", "present_count": {"$sum": 1}}},
    ]
    present_map = {}
    async for doc in db.attendance.aggregate(pipeline):
        present_map[doc["_id"]] = doc["present_count"]

    stats = []
    async for p in db.persons.find({"is_active": True}).sort("name", 1):
        present = present_map.get(p["_id"], 0)
        rate = round((present / total_sessions) * 100, 1)
        stats.append(PersonAttendanceStat(
            person_id=str(p["_id"]),
            name=p["name"],
            department=p.get("department"),
            total_sessions=total_sessions,
            present_count=present,
            attendance_rate=rate,
            is_defaulter=rate < 75.0,
        ))

    return sorted(stats, key=lambda x: x.attendance_rate)


@router.get("/heatmap")
async def heatmap(
    days: int = Query(14, ge=1, le=60),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    since = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())
    date_range = [
        (date.today() - timedelta(days=days - i - 1)).isoformat()
        for i in range(days)
    ]

    pipeline = [
        {"$match": {"marked_at": {"$gte": since}}},
        {"$project": {
            "person_id": 1,
            "status":    1,
            "day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$marked_at"}},
        }},
    ]
    att_map: dict = {}
    async for doc in db.attendance.aggregate(pipeline):
        att_map.setdefault(doc["person_id"], {})[doc["day"]] = doc["status"]

    persons = []
    async for p in db.persons.find({"is_active": True}).sort("name", 1):
        pid = str(p["_id"])
        persons.append({
            "person_id":  pid,
            "name":       p["name"],
            "department": p.get("department"),
            "data": [
                1 if att_map.get(pid, {}).get(d) == "present" else
                0 if d in att_map.get(pid, {}) else None
                for d in date_range
            ],
        })

    return {"dates": date_range, "persons": persons}
