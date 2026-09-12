"""
routers/auth.py
Authentication router for per-user identity (Step 11).

Endpoints:
  POST /api/auth/login     - Authenticate credentials and receive a signed JWT
  POST /api/auth/register  - Create user accounts (Admin only)
  GET  /api/auth/me        - Get current authenticated user profile
"""

from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.auth import (
    AuthenticatedUser,
    create_access_token,
    hash_password,
    require_admin,
    require_operator,
    verify_password,
)
from core.database import get_db
from core.schemas import TokenResponse, UserCreate, UserLogin, UserOut

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: UserLogin,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Authenticate username and password; returns a signed JWT."""
    username = credentials.username.strip()
    user_doc = await db.users.find_one({"username": username, "is_active": True})

    if not user_doc or not verify_password(credentials.password, user_doc.get("password_hash", "")):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid username or password.",
        )

    token, expires_in = create_access_token(
        user_id=str(user_doc["_id"]),
        username=user_doc["username"],
        role=user_doc["role"],
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        role=user_doc["role"],
        username=user_doc["username"],
    )


@router.post("/register", response_model=UserOut, dependencies=[Depends(require_admin)])
async def register_user(
    body: UserCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Create a new operator or admin user (Admin only)."""
    username = body.username.strip()
    existing = await db.users.find_one({"username": username})
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"User '{username}' already exists.",
        )

    now = datetime.now(timezone.utc)
    user_doc = {
        "username": username,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "is_active": True,
        "created_at": now,
    }
    result = await db.users.insert_one(user_doc)

    return UserOut(
        id=str(result.inserted_id),
        username=username,
        role=body.role,
        is_active=True,
        created_at=now,
    )


@router.get("/me", response_model=UserOut, dependencies=[Depends(require_operator)])
async def get_current_profile(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return the profile of the currently authenticated user."""
    user = getattr(request.state, "user", None)
    if not isinstance(user, AuthenticatedUser):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated.")

    if user.auth_type == "jwt" and ObjectId.is_valid(user.id):
        doc = await db.users.find_one({"_id": ObjectId(user.id)})
        if doc:
            return UserOut(
                id=str(doc["_id"]),
                username=doc["username"],
                role=doc["role"],
                is_active=doc.get("is_active", True),
                created_at=doc.get("created_at", datetime.now(timezone.utc)),
            )

    return UserOut(
        id=user.id,
        username=user.username,
        role=user.role,
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )


@router.get("/users", response_model=list[UserOut], dependencies=[Depends(require_admin)])
async def list_users(
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List all registered users (Admin only)."""
    users = []
    async for doc in db.users.find().sort("created_at", -1):
        users.append(
            UserOut(
                id=str(doc["_id"]),
                username=doc["username"],
                role=doc.get("role", "operator"),
                is_active=doc.get("is_active", True),
                created_at=doc.get("created_at", datetime.now(timezone.utc)),
            )
        )
    return users
