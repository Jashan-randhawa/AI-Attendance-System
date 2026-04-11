"""
core/schemas.py
Pydantic v2 models for all API request and response payloads.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Person ────────────────────────────────────────────────────────────────────
class PersonCreate(BaseModel):
    name:       str = Field(..., min_length=2, max_length=120)
    email:      Optional[str] = None
    department: Optional[str] = None


class PersonOut(BaseModel):
    id:          str
    name:        str
    email:       Optional[str]
    department:  Optional[str]
    photo_url:   Optional[str]
    enrolled_at: datetime
    is_active:   bool

    model_config = {"from_attributes": True}


# ── Session ───────────────────────────────────────────────────────────────────
class SessionCreate(BaseModel):
    label:      str = Field(..., min_length=2, max_length=200)
    department: Optional[str] = None


class SessionOut(BaseModel):
    id:         str
    label:      str
    department: Optional[str]
    started_at: datetime
    ended_at:   Optional[datetime]
    is_active:  bool

    model_config = {"from_attributes": True}


# ── Attendance ────────────────────────────────────────────────────────────────
class AttendanceOut(BaseModel):
    id:           str
    person_id:    str
    person_name:  str
    department:   Optional[str]
    session_id:   str
    session_label: str
    marked_at:    datetime
    confidence:   Optional[float]
    status:       str

    model_config = {"from_attributes": True}


class IdentifyResult(BaseModel):
    azure_person_id: str
    name:            str
    confidence:      float
    face_box:        dict
    already_marked:  bool = False


class MarkAttendanceResponse(BaseModel):
    session_id:  str
    identified:  List[IdentifyResult]
    new_records: int                    # how many were freshly marked


# ── Dashboard ─────────────────────────────────────────────────────────────────
class DashboardMetrics(BaseModel):
    total_enrolled:   int
    sessions_today:   int
    present_today:    int
    attendance_rate:  float             # percentage


class ActivityItem(BaseModel):
    id:            str
    person_name:   str
    department:    Optional[str]
    session_label: str
    marked_at:     str
    confidence:    Optional[float]
    status:        str


# ── Reports ───────────────────────────────────────────────────────────────────
class DailyAttendanceStat(BaseModel):
    date:             str               # ISO date string
    total_sessions:   int
    total_present:    int
    attendance_rate:  float


class PersonAttendanceStat(BaseModel):
    person_id:        str
    name:             str
    department:       Optional[str]
    total_sessions:   int
    present_count:    int
    attendance_rate:  float
    is_defaulter:     bool              # True if rate < 75%
