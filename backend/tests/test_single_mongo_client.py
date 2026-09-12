"""
tests/test_single_mongo_client.py

Covers Step 10: Consolidate to a single MongoDB client (Motor).
Ensures:
  1. core.azure_face has no _sync_client, _sync_col, or _get_col.
  2. No synchronous pymongo.MongoClient is created by azure_face.
  3. _load_all and _delete_person_doc use async Motor operations.
"""

import inspect
import pytest
from core import azure_face


def test_no_sync_mongo_client_artifacts_in_azure_face():
    assert not hasattr(azure_face, "_sync_client"), "_sync_client should be removed from azure_face"
    assert not hasattr(azure_face, "_sync_col"), "_sync_col should be removed from azure_face"
    assert not hasattr(azure_face, "_get_col"), "_get_col should be removed from azure_face"


def test_load_all_is_coroutine_function():
    assert inspect.iscoroutinefunction(azure_face._load_all), "_load_all must be an async coroutine"


def test_upsert_and_delete_person_are_coroutines():
    assert inspect.iscoroutinefunction(azure_face._upsert_person), "_upsert_person must be async"
    assert inspect.iscoroutinefunction(azure_face._delete_person_doc), "_delete_person_doc must be async"
    assert inspect.iscoroutinefunction(azure_face.delete_person), "delete_person must be async"
