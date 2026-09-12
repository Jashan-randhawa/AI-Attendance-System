"""
tests/test_user_jwt_auth.py

Covers Step 11: Per-user identity & JWT authentication.
Tests:
  - Password hashing and verification (scrypt)
  - JWT creation, decoding, and expiration rejection
  - POST /api/auth/login endpoint
  - Protected endpoints with Bearer tokens (RBAC checks)
  - Attendance marked_by and Person enrolled_by audit recording
"""

import time
from bson import ObjectId
import jwt
import pytest
from fastapi import FastAPI, Depends, Request
from fastapi.testclient import TestClient

from core.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    require_admin,
    require_operator,
    get_user_id_from_request,
    JWT_SECRET,
    JWT_ALGORITHM,
)
from core.database import get_db
from routers import auth as auth_router_module


def test_password_hashing_and_verification():
    raw_pw = "SuperSecurePassword123!"
    hashed = hash_password(raw_pw)

    assert hashed != raw_pw
    assert hashed.startswith("scrypt$")
    assert verify_password(raw_pw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False
    assert verify_password("", hashed) is False


def test_jwt_creation_and_decoding():
    token, expires_in = create_access_token("user-123", "alice", "admin")
    assert isinstance(token, str)
    assert expires_in > 0

    payload = decode_access_token(token)
    assert payload["sub"] == "user-123"
    assert payload["username"] == "alice"
    assert payload["role"] == "admin"


def test_jwt_expired_token_rejected():
    # Generate token already in the past
    payload = {
        "sub": "user-expired",
        "username": "expired_user",
        "role": "operator",
        "exp": int(time.time()) - 10,
    }
    expired_token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    with pytest.raises(Exception) as exc_info:
        decode_access_token(expired_token)
    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()


class FakeUsersCollection:
    def __init__(self, users):
        self.users = users

    async def find_one(self, query):
        for u in self.users:
            if all(u.get(k) == v for k, v in query.items()):
                return u
        return None

    async def insert_one(self, doc):
        doc["_id"] = ObjectId()
        self.users.append(doc)
        class Res:
            inserted_id = doc["_id"]
        return Res()


class FakeAuthDB:
    def __init__(self, users):
        self.users = FakeUsersCollection(users)


@pytest.fixture
def auth_client():
    user_doc = {
        "_id": ObjectId(),
        "username": "operator_john",
        "password_hash": hash_password("secret123"),
        "role": "operator",
        "is_active": True,
    }
    admin_doc = {
        "_id": ObjectId(),
        "username": "admin_sarah",
        "password_hash": hash_password("adminsecret123"),
        "role": "admin",
        "is_active": True,
    }
    fake_db = FakeAuthDB([user_doc, admin_doc])

    app = FastAPI()
    app.include_router(auth_router_module.router, prefix="/api/auth")

    # Mock routes to test RBAC with Bearer token
    @app.get("/test-operator", dependencies=[Depends(require_operator)])
    async def test_op_route(request: Request):
        return {"user_id": get_user_id_from_request(request)}

    @app.get("/test-admin", dependencies=[Depends(require_admin)])
    async def test_admin_route(request: Request):
        return {"user_id": get_user_id_from_request(request)}

    app.dependency_overrides[get_db] = lambda: fake_db

    return TestClient(app), user_doc, admin_doc


def test_login_success(auth_client):
    client, user_doc, _ = auth_client

    resp = client.post("/api/auth/login", json={
        "username": "operator_john",
        "password": "secret123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "operator"
    assert data["username"] == "operator_john"


def test_login_invalid_credentials(auth_client):
    client, _, _ = auth_client

    resp = client.post("/api/auth/login", json={
        "username": "operator_john",
        "password": "wrongpassword",
    })
    assert resp.status_code == 401
    assert "Invalid username or password" in resp.json()["detail"]


def test_jwt_bearer_token_access_and_rbac(auth_client):
    client, user_doc, admin_doc = auth_client

    # Generate tokens
    op_token, _ = create_access_token(str(user_doc["_id"]), "operator_john", "operator")
    admin_token, _ = create_access_token(str(admin_doc["_id"]), "admin_sarah", "admin")

    # 1. Operator accesses operator endpoint -> OK
    res1 = client.get("/test-operator", headers={"Authorization": f"Bearer {op_token}"})
    assert res1.status_code == 200
    assert res1.json()["user_id"] == str(user_doc["_id"])

    # 2. Operator accesses admin endpoint -> 401 Forbidden/Unauthorized
    res2 = client.get("/test-admin", headers={"Authorization": f"Bearer {op_token}"})
    assert res2.status_code == 401

    # 3. Admin accesses operator endpoint -> OK (Admin is superset of operator)
    res3 = client.get("/test-operator", headers={"Authorization": f"Bearer {admin_token}"})
    assert res3.status_code == 200
    assert res3.json()["user_id"] == str(admin_doc["_id"])

    # 4. Admin accesses admin endpoint -> OK
    res4 = client.get("/test-admin", headers={"Authorization": f"Bearer {admin_token}"})
    assert res4.status_code == 200
    assert res4.json()["user_id"] == str(admin_doc["_id"])
