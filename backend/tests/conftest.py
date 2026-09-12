"""
tests/conftest.py

Shared fixtures for the backend test suite (Remediation Plan item #11).

Nothing here touches a real MongoDB instance or downloads the InsightFace
model — `core.azure_face._get_insight_app` / `_get_col` / `_load_all` are
monkeypatched per-test with lightweight fakes, so the suite runs in a couple
of seconds anywhere `pip install -r requirements-dev.txt` has been run.
"""

import os
import numpy as np
import pytest

# Set required env vars *before* any app module is imported, since
# core.auth.API_KEY and core.database.MONGO_URL are read at import time.
os.environ.setdefault("API_KEY", "test-api-key")
os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")


class FakeFace:
    """Stand-in for an insightface `Face` result object."""

    def __init__(self, embedding, bbox, det_score=0.90, kps=None):
        self.embedding = np.array(embedding, dtype=np.float32)
        self.bbox = np.array(bbox, dtype=np.float32)
        self.det_score = det_score
        # Two eye keypoints far enough apart to pass the "extreme angle"
        # check by default; individual tests override this to exercise the
        # rejection path.
        self.kps = kps if kps is not None else np.array([[30, 40], [70, 40]])


class FakeInsightApp:
    """Stand-in for the InsightFace `FaceAnalysis` app — `.get(image)` only."""

    def __init__(self, faces_by_call=None, default_faces=None):
        # Either a fixed list returned on every .get() call, or a queue of
        # per-call return values (list of lists) for tests that need the
        # "no face on first pass, retry with flip/brightness" branch.
        self._queue = list(faces_by_call) if faces_by_call is not None else None
        self._default = default_faces if default_faces is not None else []
        self.calls = 0

    def get(self, _img):
        self.calls += 1
        if self._queue is not None:
            if self._queue:
                return self._queue.pop(0)
            return []
        return self._default


def make_embedding(seed: int, dim: int = 8) -> np.ndarray:
    """Deterministic pseudo-embedding so cosine similarity is reproducible."""
    rng = np.random.default_rng(seed)
    v = rng.normal(size=dim)
    return v / np.linalg.norm(v)


@pytest.fixture
def patch_bytes_to_bgr(monkeypatch):
    """azure_face._bytes_to_bgr is pure image preprocessing — not what these
    tests exercise, so replace it with a trivial stand-in."""
    from core import azure_face

    def _fake(image_bytes: bytes):
        return np.zeros((120, 120, 3), dtype=np.uint8)

    monkeypatch.setattr(azure_face, "_bytes_to_bgr", _fake)
    return _fake
