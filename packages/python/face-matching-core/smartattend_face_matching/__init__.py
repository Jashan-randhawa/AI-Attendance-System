"""
smartattend_face_matching
Provider-neutral face embedding normalization, cosine similarity, and top-K candidate matching engine.
"""

from .matching import (
    cosine_similarity,
    normalize_embedding,
    find_best_match,
    rank_matches,
    DEFAULT_CONFIDENCE_THRESHOLD,
    DEFAULT_DUPLICATE_THRESHOLD,
)
from .types import MatchCandidate, MatchResult, RankedMatch

__all__ = [
    "cosine_similarity",
    "normalize_embedding",
    "find_best_match",
    "rank_matches",
    "DEFAULT_CONFIDENCE_THRESHOLD",
    "DEFAULT_DUPLICATE_THRESHOLD",
    "MatchCandidate",
    "MatchResult",
    "RankedMatch",
]
