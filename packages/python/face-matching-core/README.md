# smartattend-face-matching

> Provider-neutral face embedding normalization, cosine similarity, and top-K candidate matching engine.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Lightweight Python library for calculating cosine similarity between face embeddings and matching probe vectors against enrolled galleries.

Features:
- Numerically stable `cosine_similarity(a, b)`
- Vector L2 normalization `normalize_embedding(v)`
- Gallery matching: `find_best_match(query, candidates, threshold)`
- Top-K ranking: `rank_matches(query, candidates, top_k)`
- Works with InsightFace, FaceNet, OpenFace, or any 128-d / 512-d feature vectors

---

## Installation

```bash
pip install smartattend-face-matching
```

---

## Quick Start

```python
from smartattend_face_matching import cosine_similarity, find_best_match, MatchCandidate

emb_a = [0.12, -0.45, 0.88, ...]
emb_b = [0.10, -0.42, 0.85, ...]

similarity = cosine_similarity(emb_a, emb_b)
print(f"Cosine Similarity: {similarity:.4f}")

candidates = [
    MatchCandidate(id="p1", name="Alice", embeddings=[emb_b]),
]

result = find_best_match(emb_a, candidates, threshold=0.40)
if result.matched:
    print(f"Identified: {result.candidate_name} ({result.score:.3f})")
```

---

## License

MIT © [Jashan Randhawa](https://github.com/Jashan-randhawa)
