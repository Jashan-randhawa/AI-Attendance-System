"""
tests/test_auth_roles.py

Covers the operator/admin role split (Remediation Plan item #14):
  - an admin key satisfies both require_admin and require_operator
  - an operator key satisfies require_operator but NOT require_admin
  - no/garbage key is rejected on both
  - a role with no key configured fails closed (503), not open
"""

import importlib

import pytest
from fastapi import HTTPException


def _dependant_callables(route) -> set:
    """Names of every callable wired into a route's dependency tree
    (top-level `dependencies=[...]` plus any parameter-level Depends)."""
    names = set()
    for dep in route.dependant.dependencies:
        if dep.call is not None:
            names.add(dep.call.__name__)
    return names


def _route(router, path: str, method: str):
    for r in router.routes:
        if r.path == path and method in r.methods:
            return r
    raise AssertionError(f"No route found for {method} {path}")


@pytest.fixture
def auth_module(monkeypatch):
    """Reload core.auth per test so ADMIN_API_KEYS/OPERATOR_API_KEYS reflect
    whatever env vars this test sets (they're read once at import time)."""
    monkeypatch.setenv("API_KEY_ADMIN", "admin-secret-1,admin-secret-2")
    monkeypatch.setenv("API_KEY_OPERATOR", "operator-secret-1")
    monkeypatch.delenv("API_KEY", raising=False)

    from core import auth as auth_mod
    importlib.reload(auth_mod)
    yield auth_mod
    importlib.reload(auth_mod)  # restore normal env-driven state for later tests


@pytest.mark.asyncio
async def test_admin_key_passes_require_admin(auth_module):
    assert await auth_module.require_admin(x_api_key="admin-secret-1") is True


@pytest.mark.asyncio
async def test_admin_key_passes_require_operator_too(auth_module):
    """Admin is a superset of operator — an admin key must work on operator endpoints."""
    assert await auth_module.require_operator(x_api_key="admin-secret-2") is True


@pytest.mark.asyncio
async def test_operator_key_passes_require_operator(auth_module):
    assert await auth_module.require_operator(x_api_key="operator-secret-1") is True


@pytest.mark.asyncio
async def test_operator_key_does_not_pass_require_admin(auth_module):
    """The core of RBAC: an operator key must NOT unlock admin-only endpoints."""
    with pytest.raises(HTTPException) as exc_info:
        await auth_module.require_admin(x_api_key="operator-secret-1")
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_garbage_key_rejected_on_both_roles(auth_module):
    with pytest.raises(HTTPException) as exc_info:
        await auth_module.require_admin(x_api_key="not-a-real-key")
    assert exc_info.value.status_code == 401

    with pytest.raises(HTTPException) as exc_info:
        await auth_module.require_operator(x_api_key="not-a-real-key")
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_missing_key_rejected(auth_module):
    with pytest.raises(HTTPException) as exc_info:
        await auth_module.require_operator(x_api_key="")
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_unconfigured_role_fails_closed_not_open(monkeypatch):
    """If no key is configured for a role at all, the dependency must refuse
    every request with 503 — it must never silently allow access through."""
    monkeypatch.delenv("API_KEY_ADMIN", raising=False)
    monkeypatch.delenv("API_KEY_OPERATOR", raising=False)
    monkeypatch.delenv("API_KEY", raising=False)

    from core import auth as auth_mod
    importlib.reload(auth_mod)
    try:
        with pytest.raises(HTTPException) as exc_info:
            await auth_mod.require_admin(x_api_key="anything")
        assert exc_info.value.status_code == 503

        with pytest.raises(HTTPException) as exc_info:
            await auth_mod.require_operator(x_api_key="anything")
        assert exc_info.value.status_code == 503
    finally:
        importlib.reload(auth_mod)


@pytest.mark.asyncio
async def test_legacy_api_key_still_works_as_admin_key(monkeypatch):
    """Backward compatibility: a Phase-0-style deployment with only the
    legacy API_KEY set should still authenticate as admin."""
    monkeypatch.setenv("API_KEY", "legacy-secret")
    monkeypatch.delenv("API_KEY_ADMIN", raising=False)
    monkeypatch.delenv("API_KEY_OPERATOR", raising=False)

    from core import auth as auth_mod
    importlib.reload(auth_mod)
    try:
        assert await auth_mod.require_admin(x_api_key="legacy-secret") is True
        # Admin (including the legacy key) still satisfies operator endpoints.
        assert await auth_mod.require_operator(x_api_key="legacy-secret") is True
    finally:
        importlib.reload(auth_mod)


# ─── Regression: previously-unauthenticated routes must now require a role ──
# (Phase 4 findings #1 "/identify has no auth" and #2 "read endpoints are
# unauthenticated"). These check the route's wired dependency tree directly,
# rather than firing a real HTTP request through TestClient, since the app's
# lifespan (main.lifespan) pings a real MongoDB on startup and this suite
# intentionally runs without one (see conftest.py).

def test_identify_route_requires_operator():
    from routers import attendance
    route = _route(attendance.router, "/identify", "POST")
    assert "require_operator" in _dependant_callables(route)


def test_attendance_list_route_requires_operator():
    from routers import attendance
    route = _route(attendance.router, "", "GET")
    assert "require_operator" in _dependant_callables(route)


def test_sessions_list_and_detail_routes_require_operator():
    from routers import sessions
    for path in ("", "/{session_id}"):
        route = _route(sessions.router, path, "GET")
        assert "require_operator" in _dependant_callables(route)


def test_dashboard_routes_require_operator():
    from routers import dashboard
    for path in ("/metrics", "/activity"):
        route = _route(dashboard.router, path, "GET")
        assert "require_operator" in _dependant_callables(route)


def test_reports_routes_require_admin():
    from routers import reports
    for path in ("/daily", "/persons", "/heatmap"):
        route = _route(reports.router, path, "GET")
        assert "require_admin" in _dependant_callables(route)


def test_persons_list_and_detail_routes_require_admin():
    from routers import persons
    for path in ("", "/{person_id}"):
        route = _route(persons.router, path, "GET")
        assert "require_admin" in _dependant_callables(route)
