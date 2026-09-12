"""
tests/test_face_matching.py

Covers:
  - _cosine_similarity edge cases
  - _check_face_quality rejection paths
  - identify_faces() threshold behavior (mocked InsightFace + MongoDB store)
"""

import numpy as np
import pytest

from core import azure_face
from tests.conftest import FakeFace, FakeInsightApp, make_embedding


# ── _cosine_similarity ─────────────────────────────────────────────────────

def test_cosine_similarity_identical_vectors_is_one():
    v = np.array([1.0, 2.0, 3.0])
    assert azure_face._cosine_similarity(v, v) == pytest.approx(1.0)


def test_cosine_similarity_orthogonal_vectors_is_zero():
    a = np.array([1.0, 0.0])
    b = np.array([0.0, 1.0])
    assert azure_face._cosine_similarity(a, b) == pytest.approx(0.0)


def test_cosine_similarity_opposite_vectors_is_negative_one():
    a = np.array([1.0, 0.0])
    b = np.array([-1.0, 0.0])
    assert azure_face._cosine_similarity(a, b) == pytest.approx(-1.0)


def test_cosine_similarity_zero_vector_returns_zero_not_nan():
    """A zero-norm vector would divide by zero — must return 0.0, not NaN/crash."""
    a = np.array([0.0, 0.0, 0.0])
    b = np.array([1.0, 2.0, 3.0])
    assert azure_face._cosine_similarity(a, b) == 0.0
    assert azure_face._cosine_similarity(a, a) == 0.0


# ── _check_face_quality ──────────────────────────────────────────────────────

def test_quality_rejects_low_detection_confidence():
    face = FakeFace(embedding=[0.1] * 8, bbox=[10, 10, 100, 100], det_score=0.40)
    ok, reason = azure_face._check_face_quality(face, image_w=200, image_h=200)
    assert not ok
    assert "detection confidence" in reason.lower()


def test_quality_rejects_face_too_small():
    face = FakeFace(embedding=[0.1] * 8, bbox=[10, 10, 40, 40], det_score=0.95)
    ok, reason = azure_face._check_face_quality(face, image_w=200, image_h=200)
    assert not ok
    assert "too small" in reason.lower()


def test_quality_rejects_face_too_close_to_edge():
    # Image is 200x200; margin_x/margin_y = max(200*0.05, 10) = 10.
    # A box starting at x=0 is inside the 10px margin -> rejected.
    face = FakeFace(embedding=[0.1] * 8, bbox=[0, 20, 100, 120], det_score=0.95)
    ok, reason = azure_face._check_face_quality(face, image_w=200, image_h=200)
    assert not ok
    assert "edge" in reason.lower()


def test_quality_rejects_extreme_angle_via_close_eye_keypoints():
    face_w = 100 - 20  # bbox width = 80
    face = FakeFace(
        embedding=[0.1] * 8,
        bbox=[20, 20, 100, 100],
        det_score=0.95,
        kps=np.array([[50, 50], [51, 50]]),  # eyes 1px apart -> way under 20% of face_w
    )
    ok, reason = azure_face._check_face_quality(face, image_w=200, image_h=200)
    assert not ok
    assert "angle" in reason.lower()


def test_quality_accepts_a_clean_centered_face():
    face = FakeFace(
        embedding=[0.1] * 8,
        bbox=[20, 20, 120, 120],
        det_score=0.95,
        kps=np.array([[45, 60], [95, 60]]),  # 50px apart, well over 20% of 100px face_w
    )
    ok, reason = azure_face._check_face_quality(face, image_w=200, image_h=200)
    assert ok
    assert reason == ""


# ── identify_faces() threshold behavior ──────────────────────────────────────

@pytest.mark.asyncio
async def test_identify_returns_no_matches_when_store_is_empty(monkeypatch, patch_bytes_to_bgr):
    monkeypatch.setattr(azure_face, "_get_insight_app", lambda: FakeInsightApp())
    monkeypatch.setattr(azure_face, "_load_all", lambda: {})

    results = await azure_face.identify_faces(b"irrelevant-bytes")
    assert results == []


@pytest.mark.asyncio
async def test_identify_matches_above_threshold(monkeypatch, patch_bytes_to_bgr):
    known_emb = make_embedding(seed=1)
    store = {"person-1": {"name": "Alice", "embeddings": [known_emb]}}

    # The "unknown" face's embedding is the same vector -> similarity 1.0
    detected_face = FakeFace(embedding=known_emb, bbox=[20, 20, 120, 120], det_score=0.9)
    monkeypatch.setattr(azure_face, "_get_insight_app",
                         lambda: FakeInsightApp(default_faces=[detected_face]))
    monkeypatch.setattr(azure_face, "_load_all", lambda: store)

    results = await azure_face.identify_faces(b"irrelevant-bytes", confidence_threshold=0.5)
    assert len(results) == 1
    assert results[0]["name"] == "Alice"
    assert results[0]["confidence"] == pytest.approx(1.0, abs=1e-4)


@pytest.mark.asyncio
async def test_identify_excludes_matches_below_threshold(monkeypatch, patch_bytes_to_bgr):
    known_emb = make_embedding(seed=1)
    # A very different embedding -> low cosine similarity to the enrolled one.
    unrelated_emb = -known_emb
    store = {"person-1": {"name": "Alice", "embeddings": [known_emb]}}

    detected_face = FakeFace(embedding=unrelated_emb, bbox=[20, 20, 120, 120], det_score=0.9)
    monkeypatch.setattr(azure_face, "_get_insight_app",
                         lambda: FakeInsightApp(default_faces=[detected_face]))
    monkeypatch.setattr(azure_face, "_load_all", lambda: store)

    # similarity here is -1.0, well under any reasonable threshold
    results = await azure_face.identify_faces(b"irrelevant-bytes", confidence_threshold=0.5)
    assert results == []


@pytest.mark.asyncio
async def test_identify_retries_with_brightened_frame_when_no_face_found_initially(
    monkeypatch, patch_bytes_to_bgr
):
    known_emb = make_embedding(seed=2)
    store = {"person-1": {"name": "Bob", "embeddings": [known_emb]}}
    detected_face = FakeFace(embedding=known_emb, bbox=[20, 20, 120, 120], det_score=0.9)

    # First .get() call (normal frame) finds nothing; second call (brightened
    # frame, per the retry branch in identify_faces) finds the face.
    fake_app = FakeInsightApp(faces_by_call=[[], [detected_face]])
    monkeypatch.setattr(azure_face, "_get_insight_app", lambda: fake_app)
    monkeypatch.setattr(azure_face, "_load_all", lambda: store)

    results = await azure_face.identify_faces(b"irrelevant-bytes", confidence_threshold=0.5)
    assert len(results) == 1
    assert results[0]["name"] == "Bob"
    assert fake_app.calls == 2
