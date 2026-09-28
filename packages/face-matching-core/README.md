# @jashan-randhawa/face-matching-core

> Provider-neutral face embedding normalization, cosine similarity calculation, and top-K candidate matching engine.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`@jashan-randhawa/face-matching-core` extracts the vector mathematics used in facial recognition pipelines (such as InsightFace or FaceNet) into a clean, zero-dependency library.

Features:
- Fast, numerically stable cosine similarity with division-by-zero protection
- Vector validation (checks finite numbers, NaN, and dimension length)
- L2 vector normalization (`normalizeEmbedding`)
- Candidate gallery matching (`findBestMatch`) with configurable acceptance thresholds
- Top-K candidate ranking (`rankMatches`) sorted by descending similarity
- Completely isolated from machine learning framework runtimes and database layers

---

## Installation

```bash
# Via GitHub Packages
npm install @jashan-randhawa/face-matching-core
```

Ensure your `.npmrc` has the `@jashan-randhawa` registry configured:
```ini
@jashan-randhawa:registry=https://npm.pkg.github.com
```

---

## Quick Start

### Basic Cosine Similarity

```ts
import { cosineSimilarity, normalizeEmbedding } from "@jashan-randhawa/face-matching-core";

const embeddingA = [0.12, -0.45, 0.88, ...];
const embeddingB = [0.10, -0.42, 0.85, ...];

const similarity = cosineSimilarity(embeddingA, embeddingB);
console.log(`Similarity: ${(similarity * 100).toFixed(1)}%`);
```

### Matching Against a Candidate Gallery

```ts
import { findBestMatch, MatchCandidate } from "@jashan-randhawa/face-matching-core";

const enrolledCandidates: MatchCandidate[] = [
  {
    id: "usr_001",
    name: "Alice Johnson",
    embeddings: [[0.05, 0.82, -0.21, ...]], // Supports multiple enrolled photos per person
  },
  {
    id: "usr_002",
    name: "Bob Smith",
    embeddings: [[-0.45, 0.12, 0.65, ...]],
  }
];

const probeQuery = [0.06, 0.80, -0.20, ...];

// Identify best match above threshold 0.40
const result = findBestMatch(probeQuery, enrolledCandidates, 0.40);

if (result.matched) {
  console.log(`Verified identity: ${result.candidateName} (Score: ${result.score.toFixed(3)})`);
} else {
  console.log("No matching enrolled candidate found above threshold.");
}
```

---

## API Reference

### `cosineSimilarity(a, b)`
Calculates normalized cosine similarity between vectors `a` and `b`. Returns float in range `[-1.0, 1.0]`.

### `normalizeEmbedding(v)`
Normalizes vector `v` to unit Euclidean length.

### `findBestMatch(query, candidates, threshold?)`
Scans candidate list and returns highest scoring candidate above threshold.

### `rankMatches(query, candidates, options?)`
Returns descending ranked candidate list with `candidateId`, `score`, and `rank`.

---

## License

MIT © [Jashan Randhawa](https://github.com/Jashan-randhawa)
