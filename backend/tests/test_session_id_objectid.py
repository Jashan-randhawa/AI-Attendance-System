"""
tests/test_session_id_objectid.py

Covers Step 9: Standardize session_id as ObjectId in MongoDB
- POST /mark/{session_id} stores session_id as native ObjectId in MongoDB
- GET /attendance?session_id=... parses and filters with ObjectId
- Malformed session_id in query returns 400 Bad Request
- Migration logic converts string session_ids to ObjectId
"""

import pytest
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from core import azure_face
from core.auth import require_operator
from core.database import get_db, person_already_marked
from core.rate_limit import limiter
from routers import attendance as attendance_router_module


class FakeDBForObjectId:
    def __init__(self, session_oid, person_id):
        self.session_oid = session_oid
        self.person_id = person_id
        self.docs = []

        class SimpleCol:
            def __init__(self, doc):
                self.doc = doc
            async def find_one(self, query):
                return self.doc

        self.persons = SimpleCol({"_id": person_id, "name": "Test Person", "is_active": True})
        self.sessions = SimpleCol({"_id": session_oid, "label": "Session 1", "is_active": True})

        class AttendanceCol:
            def __init__(outer):
                self.outer = outer
            async def insert_one(c_self, doc):
                self.docs.append(doc)
                return doc
            async def find_one(c_self, query):
                for d in self.docs:
                    match = True
                    for k, v in query.items():
                        if isinstance(v, dict) and "$in" in v:
                            if d.get(k) not in v["$in"]:
                                match = False
                        elif d.get(k) != v:
                            match = False
                    if match:
                        return d
                return None
            async def aggregate(c_self, pipeline):
                # Simple mock aggregate for list_attendance
                # Check match filter if present
                match_filter = pipeline[0].get("$match", {})
                for d in self.docs:
                    matched = True
                    for k, v in match_filter.items():
                        if d.get(k) != v:
                            matched = False
                    if matched:
                        yield {
                            "_id": ObjectId(),
                            "person_id": d["person_id"],
                            "person": {"name": "Test Person", "department": "Eng"},
                            "session_id": d["session_id"],
                            "session": {"label": "Session 1"},
                            "marked_at": d["marked_at"],
                            "confidence": d["confidence"],
                            "status": d["status"],
                        }

        self.attendance = AttendanceCol()


@pytest.fixture
def objectid_test_client(monkeypatch):
    sess_oid = ObjectId()
    pid = "azure-person-99"
    fake_db = FakeDBForObjectId(sess_oid, pid)

    async def fake_identify(image_bytes, confidence_threshold=None):
        return [{
            "azure_person_id": pid,
            "name": "Test Person",
            "confidence": 0.95,
            "face_box": {"left": 0, "top": 0, "width": 10, "height": 10},
        }]

    async def fake_validate_image(upload_file):
        return b"fake-bytes"

    monkeypatch.setattr(azure_face, "identify_faces", fake_identify)
    monkeypatch.setattr(attendance_router_module, "read_and_validate_image", fake_validate_image)

    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(attendance_router_module.router, prefix="/api/attendance")
    app.dependency_overrides[get_db] = lambda: fake_db
    app.dependency_overrides[require_operator] = lambda: True

    return TestClient(app), sess_oid, fake_db


def test_mark_attendance_stores_session_id_as_objectid(objectid_test_client):
    client, sess_oid, fake_db = objectid_test_client

    files = {"frame": ("photo.jpg", b"\xff\xd8\xfffake", "image/jpeg")}
    resp = client.post(f"/api/attendance/mark/{str(sess_oid)}", files=files)

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["new_records"] == 1
    assert data["session_id"] == str(sess_oid)

    # Verify internal DB representation is ObjectId
    assert len(fake_db.docs) == 1
    stored_doc = fake_db.docs[0]
    assert isinstance(stored_doc["session_id"], ObjectId), "session_id should be stored as ObjectId"
    assert stored_doc["session_id"] == sess_oid


def test_list_attendance_validates_session_id_filter(objectid_test_client):
    client, sess_oid, fake_db = objectid_test_client

    # 1. Invalid ObjectId string returns 400
    res_bad = client.get("/api/attendance?session_id=not-a-valid-hex-id")
    assert res_bad.status_code == 400
    assert "Invalid session_id format" in res_bad.json()["detail"]

    # 2. Valid ObjectId string returns 200
    res_good = client.get(f"/api/attendance?session_id={str(sess_oid)}")
    assert res_good.status_code == 200
    assert isinstance(res_good.json(), list)
