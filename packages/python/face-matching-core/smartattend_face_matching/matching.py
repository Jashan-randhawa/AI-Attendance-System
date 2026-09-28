import math
from typing import List, Union, Sequence, Optional
import numpy as np

from .types import MatchCandidate, MatchResult, RankedMatch

DEFAULT_CONFIDENCE_THRESHOLD = 0.40
DEFAULT_DUPLICATE_THRESHOLD = 0.45


def cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    """
    Computes cosine similarity between two feature vectors: dot(a, b) / (norm(a) * norm(b)).
    Returns float in range [-1.0, 1.0].
    """
    if a is None or b is None:
        return 0.0
    if len(a) != len(b):
        raise ValueError(f"Vector length mismatch: {len(a)} vs {len(b)}")

    arr_a = np.asarray(a, dtype=np.float32)
    arr_b = np.asarray(b, dtype=np.float32)

    if not np.all(np.isfinite(arr_a)) or not np.all(np.isfinite(arr_b)):
        raise ValueError("Cannot calculate similarity: vectors contain NaN or Infinity")

    norm_a = np.linalg.norm(arr_a)
    norm_b = np.linalg.norm(arr_b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    dot = np.dot(arr_a, arr_b)
    sim = float(dot / (norm_a * norm_b))
    return max(-1.0, min(1.0, sim))


def normalize_embedding(v: Sequence[float]) -> np.ndarray:
    """
    Normalizes a vector to unit length (L2 norm = 1.0).
    """
    arr = np.asarray(v, dtype=np.float32)
    if not np.all(np.isfinite(arr)):
        raise ValueError("Embedding contains NaN or Infinity")
    norm = np.linalg.norm(arr)
    if norm == 0:
        return np.zeros_like(arr)
    return arr / norm


def rank_matches(
    query: Sequence[float],
    candidates: List[MatchCandidate],
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    top_k: Optional[int] = None,
) -> List[RankedMatch]:
    """
    Ranks candidates by descending cosine similarity against query embedding.
    """
    scored = []
    for cand in candidates:
        best_score = -1.0
        embeddings = cand.embeddings
        if isinstance(embeddings, np.ndarray) and embeddings.ndim == 1:
            embeddings = [embeddings]

        for emb in embeddings:
            if len(emb) != len(query):
                continue
            score = cosine_similarity(query, emb)
            if score > best_score:
                best_score = score

        if best_score > -1.0:
            scored.append((cand, best_score))

    scored.sort(key=lambda x: x[1], reverse=True)
    if top_k is not None:
        scored = scored[:top_k]

    return [
        RankedMatch(
            candidate_id=c.id,
            candidate_name=c.name,
            score=s,
            confidence=max(0.0, s),
            matched=s >= threshold,
            rank=i + 1,
            metadata=c.metadata,
        )
        for i, (c, s) in enumerate(scored)
    ]


def find_best_match(
    query: Sequence[float],
    candidates: List[MatchCandidate],
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
) -> MatchResult:
    """
    Finds the single highest scoring candidate above threshold.
    """
    if not candidates:
        return MatchResult(matched=False, threshold=threshold)

    ranked = rank_matches(query, candidates, threshold=threshold, top_k=1)
    if not ranked:
        return MatchResult(matched=False, threshold=threshold)

    top = ranked[0]
    matched = top.score >= threshold

    return MatchResult(
        matched=matched,
        candidate_id=top.candidate_id if matched else None,
        candidate_name=top.candidate_name if matched else None,
        score=top.score,
        confidence=top.confidence,
        threshold=threshold,
        metadata=top.metadata,
    )
