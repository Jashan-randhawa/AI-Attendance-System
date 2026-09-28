from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Union

@dataclass
class MatchCandidate:
    id: str
    name: Optional[str] = None
    embeddings: List[List[float]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class MatchResult:
    matched: bool
    candidate_id: Optional[str] = None
    candidate_name: Optional[str] = None
    score: float = 0.0
    confidence: float = 0.0
    threshold: float = 0.40
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class RankedMatch:
    candidate_id: str
    candidate_name: Optional[str] = None
    score: float = 0.0
    confidence: float = 0.0
    matched: bool = False
    rank: int = 1
    metadata: Dict[str, Any] = field(default_factory=dict)
