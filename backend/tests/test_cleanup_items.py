"""
tests/test_cleanup_items.py

Covers Phase 4 findings:
  #7 — datetime.utcnow() (deprecated, naive-UTC) replaced with
       datetime.now(UTC) (timezone-aware) at every call site.
  #8 — the dead train_person_group() no-op removed from core/azure_face.py.
"""

import ast
import pathlib


BACKEND_ROOT = pathlib.Path(__file__).parent.parent


def _all_py_files():
    for sub in ("routers", "core"):
        yield from (BACKEND_ROOT / sub).glob("*.py")


def test_no_datetime_utcnow_call_sites_remain():
    offenders = []
    for path in _all_py_files():
        if "datetime.utcnow()" in path.read_text():
            offenders.append(path.name)
    assert offenders == [], f"Deprecated datetime.utcnow() still used in: {offenders}"


def test_attendance_and_persons_and_sessions_use_timezone_aware_now():
    for path in (BACKEND_ROOT / "routers" / "attendance.py",
                 BACKEND_ROOT / "routers" / "persons.py",
                 BACKEND_ROOT / "routers" / "sessions.py"):
        source = path.read_text()
        assert "datetime.now(UTC)" in source, f"{path.name} should use datetime.now(UTC)"


def test_train_person_group_no_longer_exists():
    from core import azure_face
    assert not hasattr(azure_face, "train_person_group")


def test_train_person_group_has_no_remaining_call_sites():
    offenders = []
    for path in _all_py_files():
        if "train_person_group" in path.read_text():
            offenders.append(path.name)
    assert offenders == [], f"Dead train_person_group() still referenced in: {offenders}"
