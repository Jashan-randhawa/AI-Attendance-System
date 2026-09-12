"""
tests/test_cors_config.py

Covers the CORS wildcard guard added for Remediation Plan item #16:
allow_origins=["*"] + allow_credentials=True must never be allowed to start.
"""

import importlib
import sys

import pytest


def _reload_main_module_function():
    """
    main.py resolves CORS origins (and does other startup work) at import
    time, so we can't just `import main` fresh in-process without also
    re-triggering the FastAPI app construction. Instead, exercise the
    resolver function directly by importing main once and reusing
    `_resolve_cors_origins`, re-running it under different env vars.
    """
    if "main" in sys.modules:
        return sys.modules["main"]._resolve_cors_origins
    import main
    return main._resolve_cors_origins


@pytest.fixture
def resolve_cors_origins(monkeypatch):
    monkeypatch.setenv("MONGODB_URL", "mongodb://localhost:27017")
    monkeypatch.setenv("API_KEY_ADMIN", "test-admin-key")
    return _reload_main_module_function()


def test_wildcard_origin_is_rejected_at_startup(resolve_cors_origins, monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "*")
    with pytest.raises(RuntimeError, match="wildcard"):
        resolve_cors_origins()


def test_wildcard_mixed_with_real_origins_is_still_rejected(resolve_cors_origins, monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://example.com,*")
    with pytest.raises(RuntimeError, match="wildcard"):
        resolve_cors_origins()


def test_explicit_origins_are_accepted_and_deduped(resolve_cors_origins, monkeypatch):
    monkeypatch.setenv(
        "ALLOWED_ORIGINS",
        "https://example.com, https://example.com, http://localhost:5173",
    )
    origins = resolve_cors_origins()
    assert "https://example.com" in origins
    assert origins.count("https://example.com") == 1
    assert "*" not in origins


def test_no_env_origins_returns_only_defaults(resolve_cors_origins, monkeypatch):
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    origins = resolve_cors_origins()
    assert "*" not in origins
    assert "http://localhost:5173" in origins
