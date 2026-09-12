"""
tests/test_attendance_idempotency.py

Covers the already_marked idempotency path in POST /mark/{session_id}
(Remediation Plan item #11): a person identified twice in the same session
must be marked present exactly once, and the second (and later) hits must
be reported back as already_marked=True with new_records not incremented.

Mounts routers.attendance in a minimal FastAPI app (skipping main.py's
lifespan, which pings a real MongoDB and loads the InsightFace model) and
swaps in an in-memory fake Motor-like database plus a mocked
azure_face.identify_faces so no model or database is required.
"""

from datetime import datetime

import pytest
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from core import azure_face
from core.auth import require_operator
from core.database import get_db
from core.rate_limit import limiter
from routers import attendance as attendance_router_module


class FakeAttendanceCollection:
    """Mimics the bits of a Motor collection that mark_attendance touches,
    including the unique-index-violation behavior on double insert."""

    def __init__(self):
        self._docs = []
        self.raise_on_insert = None  # test hook: set to an exception instance

    async def find_one(self, query):
        for doc in self._docs:
            if all(doc.get(k) == v for k, v in query.items()):
                return doc
        return None

    async def insert_one(self, doc):
        if self.raise_on_insert is not None:
            raise self.raise_on_insert
        key = (doc["person_id"], doc["session_id"])
        if any((d["person_id"], d["session_id"]) == key for d in self._docs):
            # Real pymongo raises DuplicateKeyError on the unique compound
            # index — mark_attendance now narrows its except clause to this
            # specific type (Phase 4 finding #4), so the fake must match.
            raise DuplicateKeyError("duplicate key: person_id + session_id")
        self._docs.append(doc)
        return doc


class FakeSimpleCollection:
    """Generic find_one-only fake for `persons` and `sessions`."""

    def __init__(self, docs):
        self._docs = docs

    async def find_one(self, query):
        for doc in self._docs:
            if all(doc.get(k) == v for k, v in query.items()):
                return doc
        return None


class FakeDB:
    def __init__(self, persons, sessions):
        self.persons = FakeSimpleCollection(persons)
        self.sessions = FakeSimpleCollection(sessions)
        self.attendance = FakeAttendanceCollection()


@pytest.fixture
def session_and_person():
    session_oid = ObjectId()
    session_doc = {"_id": session_oid, "label": "Morning", "is_active": True}
    person_doc = {"_id": "azure-person-1", "name": "Alice", "is_active": True}
    return session_oid, session_doc, person_doc


@pytest.fixture
def test_client(monkeypatch, session_and_person):
    session_oid, session_doc, person_doc = session_and_person
    fake_db = FakeDB(persons=[person_doc], sessions=[session_doc])

    # One identified face per call, matching the enrolled person above.
    async def fake_identify_faces(image_bytes, confidence_threshold=None):
        return [{
            "azure_person_id": "azure-person-1",
            "name": "Alice",
            "confidence": 0.91,
            "face_box": {"left": 0, "top": 0, "width": 10, "height": 10},
        }]

    async def fake_read_and_validate_image(upload_file):
        return b"fake-image-bytes"

    monkeypatch.setattr(azure_face, "identify_faces", fake_identify_faces)
    monkeypatch.setattr(attendance_router_module, "read_and_validate_image",
                         fake_read_and_validate_image)

    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(attendance_router_module.router, prefix="/api/attendance")
    app.dependency_overrides[get_db] = lambda: fake_db
    app.dependency_overrides[require_operator] = lambda: True

    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, fake_db, session_oid


def _mark(client, session_oid):
    return client.post(
        f"/api/attendance/mark/{session_oid}",
        files={"frame": ("frame.jpg", b"irrelevant-bytes", "image/jpeg")},
    )


def test_first_mark_creates_a_new_attendance_record(test_client):
    client, fake_db, session_oid = test_client

    resp = _mark(client, session_oid)
    assert resp.status_code == 200

    body = resp.json()
    assert body["new_records"] == 1
    assert len(body["identified"]) == 1
    assert body["identified"][0]["already_marked"] is False
    assert len(fake_db.attendance._docs) == 1


def test_second_mark_in_same_session_is_idempotent(test_client):
    """Marking the same person twice in the same session must not create a
    second attendance record, and the response must flag it as already_marked."""
    client, fake_db, session_oid = test_client

    first = _mark(client, session_oid)
    assert first.json()["new_records"] == 1

    second = _mark(client, session_oid)
    assert second.status_code == 200
    body = second.json()

    assert body["new_records"] == 0
    assert body["identified"][0]["already_marked"] is True
    # Still exactly one attendance record for this person+session.
    assert len(fake_db.attendance._docs) == 1


def test_mark_rejects_malformed_session_id(test_client):
    client, _fake_db, _session_oid = test_client
    resp = client.post(
        "/api/attendance/mark/not-a-valid-object-id",
        files={"frame": ("frame.jpg", b"irrelevant-bytes", "image/jpeg")},
    )
    assert resp.status_code == 400


def test_mark_rejects_inactive_or_unknown_session(test_client):
    client, _fake_db, _session_oid = test_client
    resp = _mark(client, ObjectId())  # a well-formed id that doesn't exist
    assert resp.status_code == 404


# ─── Regression: Phase 4 finding #4 — bare `except Exception: pass` used to
# swallow *any* insert failure, not just the expected DuplicateKeyError, so a
# genuine DB error looked identical to a successful mark from the caller's
# point of view. It must now propagate instead of being silently discarded.

def test_non_duplicate_insert_error_is_not_silently_swallowed(test_client):
    client, fake_db, session_oid = test_client
    fake_db.attendance.raise_on_insert = ConnectionError("mongo connection reset")

    resp = _mark(client, session_oid)

    # A genuine failure must NOT look like the happy-path 200/new_records=1.
    assert resp.status_code != 200 or resp.json().get("new_records") != 1
    assert resp.status_code >= 500
    assert len(fake_db.attendance._docs) == 0
