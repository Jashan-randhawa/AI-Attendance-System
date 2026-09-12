"""
tests/test_enrollment_rollback.py

Covers Phase 4 finding #3: enrollment writes a face embedding to
face_encodings (via azure_face.enroll_person) *before* inserting the person
document into `persons`. Previously, if that final insert failed, nothing
undid the embedding write, leaving an orphaned embedding that the
recognition pipeline would still match against.

This mounts routers.persons in a minimal FastAPI app (skipping main.py's
lifespan) with the face-recognition pipeline mocked out, and asserts that a
failing `db.persons.insert_one` triggers a compensating
`azure_face.delete_person` rollback and a clean 503 — not an unhandled 500
and a silently orphaned embedding.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from core import azure_face
from core.auth import require_admin
from core.database import get_db
from core.rate_limit import limiter
from core.validation import read_and_validate_image
from routers import persons as persons_router_module


class FakePersonsCollection:
    def __init__(self, raise_on_insert=None):
        self._docs = []
        self.raise_on_insert = raise_on_insert

    async def find_one(self, query):
        return None  # no existing name/person collisions

    async def insert_one(self, doc):
        if self.raise_on_insert is not None:
            raise self.raise_on_insert
        self._docs.append(doc)
        return doc


class FakeDB:
    def __init__(self, raise_on_insert=None):
        self.persons = FakePersonsCollection(raise_on_insert=raise_on_insert)


@pytest.fixture
def app_factory(monkeypatch):
    async def fake_read_and_validate_image(upload_file):
        return b"fake-image-bytes"

    async def fake_ensure_person_group():
        return None

    async def fake_check_duplicate_face(image_bytes_list):
        return None  # no duplicate

    async def fake_enroll_person(name, image_bytes_list):
        return "azure-person-new"

    async def fake_upload_photo_to_blob(azure_id, image_bytes, filename):
        return "https://blob.example/photo.jpg"

    delete_calls = []

    async def fake_delete_person(azure_person_id):
        delete_calls.append(azure_person_id)

    monkeypatch.setattr(persons_router_module, "read_and_validate_image",
                         fake_read_and_validate_image)
    monkeypatch.setattr(azure_face, "ensure_person_group", fake_ensure_person_group)
    monkeypatch.setattr(azure_face, "check_duplicate_face", fake_check_duplicate_face)
    monkeypatch.setattr(azure_face, "enroll_person", fake_enroll_person)
    monkeypatch.setattr(azure_face, "upload_photo_to_blob", fake_upload_photo_to_blob)
    monkeypatch.setattr(azure_face, "delete_person", fake_delete_person)

    def _build(fake_db):
        app = FastAPI()
        app.state.limiter = limiter
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        app.include_router(persons_router_module.router, prefix="/api/persons")
        app.dependency_overrides[get_db] = lambda: fake_db
        app.dependency_overrides[require_admin] = lambda: True
        return TestClient(app)

    return _build, delete_calls


def _enroll(client):
    return client.post(
        "/api/persons/enroll",
        data={"name": "New Person"},
        files={"photos": ("photo.jpg", b"irrelevant-bytes", "image/jpeg")},
    )


def test_successful_enrollment_does_not_roll_back(app_factory):
    build, delete_calls = app_factory
    fake_db = FakeDB(raise_on_insert=None)
    client = build(fake_db)

    resp = _enroll(client)

    assert resp.status_code == 201
    assert len(fake_db.persons._docs) == 1
    assert delete_calls == []


def test_failed_person_insert_rolls_back_the_embedding(app_factory):
    build, delete_calls = app_factory
    fake_db = FakeDB(raise_on_insert=RuntimeError("mongo write failed"))
    client = build(fake_db)

    resp = _enroll(client)

    # Caller sees a clean, generic failure — not an unhandled 500.
    assert resp.status_code == 503
    # No person document was left behind.
    assert fake_db.persons._docs == []
    # The embedding written in step 1 was cleaned up via a compensating
    # delete_person call using the same azure_id that was written.
    assert delete_calls == ["azure-person-new"]


def test_rollback_failure_still_returns_a_clean_error(app_factory):
    """Even if the compensating delete_person call itself fails, the client
    must still get a clean 503 (the orphan is logged at critical level for
    an operator to clean up via /debug-encodings, not exposed to the caller)."""
    build, delete_calls = app_factory
    fake_db = FakeDB(raise_on_insert=RuntimeError("mongo write failed"))
    client = build(fake_db)

    async def failing_delete(azure_person_id):
        delete_calls.append(azure_person_id)
        raise RuntimeError("azure delete also failed")

    import routers.persons as persons_router_module_ref
    persons_router_module_ref.azure_face.delete_person = failing_delete

    resp = _enroll(client)

    assert resp.status_code == 503
    assert fake_db.persons._docs == []
    assert delete_calls == ["azure-person-new"]
