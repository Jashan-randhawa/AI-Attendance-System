"""
tests/test_duplicate_detection.py

Covers check_duplicate_face() threshold edge cases (Remediation Plan item #11).
"""

import pytest

from core import azure_face
from tests.conftest import FakeFace, FakeInsightApp, make_embedding


@pytest.mark.asyncio
async def test_no_duplicate_when_store_is_empty(monkeypatch, patch_bytes_to_bgr):
    monkeypatch.setattr(azure_face, "_get_insight_app", lambda: FakeInsightApp())
    monkeypatch.setattr(azure_face, "_load_all", lambda: {})

    result = await azure_face.check_duplicate_face([b"photo-bytes"])
    assert result is None


@pytest.mark.asyncio
async def test_duplicate_detected_when_similarity_meets_threshold(monkeypatch, patch_bytes_to_bgr):
    enrolled_emb = make_embedding(seed=5)
    store = {"person-1": {"name": "Carol", "embeddings": [enrolled_emb]}}

    # Same embedding as enrolled -> similarity 1.0, comfortably over threshold.
    candidate_face = FakeFace(embedding=enrolled_emb, bbox=[20, 20, 120, 120], det_score=0.9)
    monkeypatch.setattr(azure_face, "_get_insight_app",
                         lambda: FakeInsightApp(default_faces=[candidate_face]))
    monkeypatch.setattr(azure_face, "_load_all", lambda: store)

    result = await azure_face.check_duplicate_face([b"photo-bytes"], similarity_threshold=0.45)
    assert result is not None
    assert result["name"] == "Carol"
    assert result["matched_on_photo"] == 1
    assert result["confidence"] == pytest.approx(1.0, abs=1e-4)


@pytest.mark.asyncio
async def test_no_duplicate_when_similarity_below_threshold(monkeypatch, patch_bytes_to_bgr):
    enrolled_emb = make_embedding(seed=5)
    unrelated_emb = -enrolled_emb
    store = {"person-1": {"name": "Carol", "embeddings": [enrolled_emb]}}

    candidate_face = FakeFace(embedding=unrelated_emb, bbox=[20, 20, 120, 120], det_score=0.9)
    monkeypatch.setattr(azure_face, "_get_insight_app",
                         lambda: FakeInsightApp(default_faces=[candidate_face]))
    monkeypatch.setattr(azure_face, "_load_all", lambda: store)

    result = await azure_face.check_duplicate_face([b"photo-bytes"], similarity_threshold=0.45)
    assert result is None


@pytest.mark.asyncio
async def test_low_confidence_detection_is_skipped_even_if_similarity_would_match(
    monkeypatch, patch_bytes_to_bgr
):
    """check_duplicate_face has its own det_score floor (0.40) separate from
    _check_face_quality's — a low-confidence detection should never surface
    as a duplicate match even if the embedding happens to be identical."""
    enrolled_emb = make_embedding(seed=7)
    store = {"person-1": {"name": "Dave", "embeddings": [enrolled_emb]}}

    weak_face = FakeFace(embedding=enrolled_emb, bbox=[20, 20, 120, 120], det_score=0.20)
    monkeypatch.setattr(azure_face, "_get_insight_app",
                         lambda: FakeInsightApp(default_faces=[weak_face]))
    monkeypatch.setattr(azure_face, "_load_all", lambda: store)

    result = await azure_face.check_duplicate_face([b"photo-bytes"], similarity_threshold=0.45)
    assert result is None


@pytest.mark.asyncio
async def test_best_match_kept_across_multiple_photos(monkeypatch, patch_bytes_to_bgr):
    """When several enrollment photos are checked, the highest-similarity
    match across all of them should win, tagged with its own photo index."""
    enrolled_emb = make_embedding(seed=9)
    store = {"person-1": {"name": "Eve", "embeddings": [enrolled_emb]}}

    weaker_face = FakeFace(embedding=make_embedding(seed=10), bbox=[20, 20, 120, 120], det_score=0.9)
    stronger_face = FakeFace(embedding=enrolled_emb, bbox=[20, 20, 120, 120], det_score=0.9)

    # Two photos processed in order: first a weak/no match, then a strong one.
    fake_app = FakeInsightApp(faces_by_call=[[weaker_face], [stronger_face]])
    monkeypatch.setattr(azure_face, "_get_insight_app", lambda: fake_app)
    monkeypatch.setattr(azure_face, "_load_all", lambda: store)

    result = await azure_face.check_duplicate_face(
        [b"photo-1", b"photo-2"], similarity_threshold=0.45
    )
    assert result is not None
    assert result["matched_on_photo"] == 2
    assert result["confidence"] == pytest.approx(1.0, abs=1e-4)
