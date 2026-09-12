"""
core/auth.py
Role-separated shared-secret authentication for mutating / sensitive endpoints.

PHASE 0 NOTE (Remediation Plan item #1):
The original version of this module was a single shared API key: every
caller with the key could do everything. That closed the "anyone on the
internet can enroll/delete people or mark attendance" hole, but a leaked
key still meant total access — no separation between "mark attendance"
and "delete every enrolled person."

PHASE 3 UPDATE (Remediation Plan item #14 — RBAC once auth exists):
Two roles now exist, both still shared-secret (no user accounts / JWTs —
that remains a possible future upgrade, not required to get real risk
reduction here):

  - operator: day-to-day session/attendance operations.
              -> create/end sessions, mark attendance.
  - admin:    everything an operator can do, PLUS enrollment/deletion of
              people, CSV export, and the /debug-* diagnostic endpoints.
              -> an admin key satisfies both require_operator and
                 require_admin; an operator key only satisfies
                 require_operator.

This means a leaked operator key (e.g. handed to whoever is running a
check-in desk) can mark attendance but cannot wipe the enrolled-persons
collection or export all attendance data — the actual scenario item #14
in the remediation plan calls out.

Usage:
    from core.auth import require_operator, require_admin

    @router.post("/sessions", dependencies=[Depends(require_operator)])
    ...
    @router.delete("/persons/{id}", dependencies=[Depends(require_admin)])
    ...

Configuration:
    Set these in the environment (.env):
      API_KEY_ADMIN     — required for admin-only endpoints.
      API_KEY_OPERATOR  — required for operator endpoints (admin key also
                          works on operator endpoints; operator key does
                          NOT work on admin endpoints).

    Backward compatibility: the legacy single `API_KEY` env var (Phase 0)
    is still honored as an additional admin key if set, so an existing
    deployment doesn't break the moment this code ships — it just doesn't
    get role separation until API_KEY_OPERATOR is also configured.

    Either env var can hold a comma-separated list of keys (to support
    rotation: add the new key, roll it out, then remove the old one,
    without a window where valid clients are locked out).

    If NO key is configured for a role, that role's dependency FAILS
    CLOSED — it refuses every protected request with a 503 rather than
    silently allowing unauthenticated access. A missing secret should
    never quietly downgrade to "no auth."

Frontend impact:
    The React frontend does not yet send this header (that update is
    scheduled for the frontend phase of the remediation plan). Until then,
    calls from the UI to protected endpoints will receive 401/503. This is
    expected during the backend-only rollout.
"""

import os
import secrets

from fastapi import Header, HTTPException, status


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


# Admin: enroll/delete persons, CSV export, /debug-* endpoints.
# Includes the legacy `API_KEY` var so Phase 0 deployments keep working.
ADMIN_API_KEYS = _load_keys("API_KEY_ADMIN", "API_KEY")

# Operator: create/end sessions, mark attendance. Admin keys are also
# accepted wherever an operator key is (see require_operator below) —
# OPERATOR_API_KEYS itself does NOT need to include the admin keys.
OPERATOR_API_KEYS = _load_keys("API_KEY_OPERATOR")


def _matches_any(candidate: str, valid_keys: set) -> bool:
    if not candidate or not valid_keys:
        return False
    # compare_digest against every configured key (not `in`) to avoid
    # short-circuiting on the first non-matching key in a way that would
    # leak timing information about *which* key was closest.
    return any(secrets.compare_digest(candidate, k) for k in valid_keys)


async def require_admin(x_api_key: str = Header(default="", alias="X-API-Key")) -> bool:
    """FastAPI dependency: admin-only endpoints (enroll/delete/export/debug)."""
    if not ADMIN_API_KEYS:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Server misconfiguration: no admin API key is configured. "
            "Set API_KEY_ADMIN (or the legacy API_KEY) in the backend environment.",
        )
    if not _matches_any(x_api_key, ADMIN_API_KEYS):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Missing or invalid admin API key. Send it as the 'X-API-Key' header.",
        )
    return True


async def require_operator(x_api_key: str = Header(default="", alias="X-API-Key")) -> bool:
    """FastAPI dependency: operator endpoints (create/end sessions, mark attendance).
    An admin key is also accepted here — admin is a superset of operator."""
    if not ADMIN_API_KEYS and not OPERATOR_API_KEYS:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Server misconfiguration: no API key is configured. "
            "Set API_KEY_OPERATOR (and/or API_KEY_ADMIN) in the backend environment.",
        )
    if _matches_any(x_api_key, ADMIN_API_KEYS) or _matches_any(x_api_key, OPERATOR_API_KEYS):
        return True
    raise HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Missing or invalid API key. Send it as the 'X-API-Key' header.",
    )


# Backward-compat alias — anything still importing `require_api_key` (old
# call sites, external scripts) gets the strictest / previous semantics
# rather than breaking outright. New code should use require_admin or
# require_operator explicitly.
require_api_key = require_admin
