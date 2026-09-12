"""
core/auth.py
Role-separated authentication with Per-User JWT Identity (Step 11)
and backward-compatible shared-secret API key fallback.

Features:
  - Per-user identity via JWT tokens (bearer authorization header).
  - Minimal user collection support with salted scrypt / bcrypt password hashing.
  - Role-based access control: operator vs. admin.
  - Backward compatibility: existing X-API-Key shared secrets remain valid
    as fallbacks during rollout (Step 11 / Finding 9).
"""

import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import jwt
from fastapi import Header, HTTPException, Request, status

logger = logging.getLogger(__name__)

# ── Password Hashing ──────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash password using hashlib.scrypt with a secure random salt."""
    salt = secrets.token_hex(16)
    key = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        maxmem=0x2000000,
    )
    return f"scrypt$16384$8$1${salt}${key.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against scrypt or bcrypt hash."""
    if not hashed or not password:
        return False
    try:
        parts = hashed.split("$")
        if len(parts) == 6 and parts[0] == "scrypt":
            _, n, r, p, salt, key_hex = parts
            derived = hashlib.scrypt(
                password.encode("utf-8"),
                salt=salt.encode("utf-8"),
                n=int(n),
                r=int(r),
                p=int(p),
                maxmem=0x2000000,
            )
            return secrets.compare_digest(derived.hex(), key_hex)
        elif hashed.startswith("$2"):
            import bcrypt
            return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception as e:
        logger.warning("Password verification error: %s", e)
        return False
    return False


# ── JWT Utilities ─────────────────────────────────────────────────────────────

JWT_SECRET = os.environ.get("JWT_SECRET", "smart-attend-jwt-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.environ.get("JWT_EXPIRY_HOURS", "12"))


def create_access_token(user_id: str, username: str, role: str) -> Tuple[str, int]:
    """Issue a signed JWT containing user ID and role claim."""
    expires_in = JWT_EXPIRY_HOURS * 3600
    expire = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token, expires_in


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Authentication token has expired. Please log in again.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid authentication token.",
        )


# ── Authenticated User Context ────────────────────────────────────────────────

class AuthenticatedUser:
    def __init__(self, id: str, username: str, role: str, auth_type: str = "jwt"):
        self.id = id
        self.username = username
        self.role = role
        self.auth_type = auth_type

    def __bool__(self):
        return True


def get_user_id_from_request(request: Optional[Request]) -> Optional[str]:
    """Safely extract user_id from request.state if authenticated."""
    if request and hasattr(request, "state"):
        user = getattr(request.state, "user", None)
        if isinstance(user, AuthenticatedUser):
            return user.id
    return None


# ── Shared-Secret Legacy Keys ─────────────────────────────────────────────────

def _load_keys(*env_names: str) -> set:
    """Collect non-empty, comma-separated key values from the given env vars."""
    keys = set()
    for name in env_names:
        raw = os.environ.get(name, "")
        for part in raw.split(","):
            part = part.strip()
            if part:
                keys.add(part)
    return keys


# Admin API keys (includes legacy single API_KEY)
ADMIN_API_KEYS = _load_keys("API_KEY_ADMIN", "API_KEY")

# Operator API keys
OPERATOR_API_KEYS = _load_keys("API_KEY_OPERATOR")


def _matches_any(candidate: str, valid_keys: set) -> bool:
    if not candidate or not valid_keys:
        return False
    return any(secrets.compare_digest(candidate, k) for k in valid_keys)


def _authenticate(
    request: Optional[Request],
    x_api_key: str,
    authorization: Optional[str],
) -> Tuple[Optional[AuthenticatedUser], bool]:
    """
    Checks Authorization header (Bearer JWT) first, then falls back to X-API-Key.
    Returns (user, no_keys_configured).
    """
    # 1. Check Bearer token
    bearer_token = None
    if isinstance(authorization, str) and authorization.lower().startswith("bearer "):
        bearer_token = authorization[7:].strip()
    elif request is not None and hasattr(request, "headers") and "authorization" in request.headers:
        auth_hdr = request.headers.get("authorization", "")
        if isinstance(auth_hdr, str) and auth_hdr.lower().startswith("bearer "):
            bearer_token = auth_hdr[7:].strip()

    if bearer_token:
        payload = decode_access_token(bearer_token)
        user = AuthenticatedUser(
            id=payload["sub"],
            username=payload.get("username", "user"),
            role=payload.get("role", "operator"),
            auth_type="jwt",
        )
        if request is not None and hasattr(request, "state"):
            request.state.user = user
        return user, False

    # 2. Legacy X-API-Key fallback
    candidate_key = x_api_key if isinstance(x_api_key, str) else ""
    if not candidate_key and request is not None and hasattr(request, "headers"):
        candidate_key = request.headers.get("X-API-Key", "")

    no_keys_configured = not ADMIN_API_KEYS and not OPERATOR_API_KEYS

    if _matches_any(candidate_key, ADMIN_API_KEYS):
        user = AuthenticatedUser(
            id="admin_key",
            username="admin",
            role="admin",
            auth_type="api_key",
        )
        if request is not None:
            request.state.user = user
        return user, False

    if _matches_any(candidate_key, OPERATOR_API_KEYS):
        user = AuthenticatedUser(
            id="operator_key",
            username="operator",
            role="operator",
            auth_type="api_key",
        )
        if request is not None:
            request.state.user = user
        return user, False

    return None, no_keys_configured


# ── RBAC Route Dependencies ───────────────────────────────────────────────────

async def require_admin(
    request: Request = None,
    x_api_key: str = Header(default="", alias="X-API-Key"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> bool:
    """FastAPI dependency: admin-only endpoints."""
    user, no_keys = _authenticate(request, x_api_key, authorization)

    if not ADMIN_API_KEYS and (not user or user.auth_type == "api_key"):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Server misconfiguration: no admin API key is configured. "
            "Set API_KEY_ADMIN (or the legacy API_KEY) in the backend environment.",
        )

    if user and user.role == "admin":
        return True

    raise HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Missing or invalid admin API key or Bearer token.",
    )


async def require_operator(
    request: Request = None,
    x_api_key: str = Header(default="", alias="X-API-Key"),
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> bool:
    """FastAPI dependency: operator endpoints (create/end sessions, mark attendance).
    An admin key or admin token is also accepted here."""
    user, no_keys = _authenticate(request, x_api_key, authorization)

    if no_keys and (not user or user.auth_type == "api_key"):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Server misconfiguration: no API key is configured. "
            "Set API_KEY_OPERATOR (and/or API_KEY_ADMIN) in the backend environment.",
        )

    if user and user.role in ("operator", "admin"):
        return True

    raise HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Missing or invalid API key or Bearer token.",
    )


# Backward-compat alias
require_api_key = require_admin
