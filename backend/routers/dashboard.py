"""
routers/dashboard.py - MongoDB version
"""

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.database import (
    get_db, count_persons, count_sessions_today,
    count_present_today, get_recent_activity,
)
from core.schemas import DashboardMetrics, ActivityItem

router = APIRouter()


@router.get("/metrics", response_model=DashboardMetrics)
async def get_metrics(db: AsyncIOMotorDatabase = Depends(get_db)):
    total   = await count_persons(db)
    today_s = await count_sessions_today(db)
    present = await count_present_today(db)
    # Rate = unique attendees today as % of total enrolled (0 if no one enrolled)
    rate    = round((present / total) * 100, 1) if total > 0 else 0.0
    return DashboardMetrics(
        total_enrolled=total,
        sessions_today=today_s,
        present_today=present,
        attendance_rate=rate,
    )


@router.get("/activity", response_model=list[ActivityItem])
async def get_activity(db: AsyncIOMotorDatabase = Depends(get_db)):
    rows = await get_recent_activity(db, limit=8)
    return [ActivityItem(**r) for r in rows]
