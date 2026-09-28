import test from "node:test";
import assert from "node:assert/strict";
import {
  cosineSimilarity,
  euclideanDistance,
  normalizeEmbedding,
  validateEmbedding,
  findBestMatch,
  rankMatches,
} from "../dist/index.js";

test("face-matching-core: Identical vectors yield similarity 1.0", () => {
  const v1 = [0.1, 0.5, 0.8, -0.3];
  const sim = cosineSimilarity(v1, v1);
  assert.ok(Math.abs(sim - 1.0) < 1e-6);
});

test("face-matching-core: Orthogonal vectors yield similarity 0.0", () => {
  const v1 = [1, 0, 0];
  const v2 = [0, 1, 0];
  const sim = cosineSimilarity(v1, v2);
  assert.ok(Math.abs(sim - 0.0) < 1e-6);
});

test("face-matching-core: Normalized and un-normalized vectors produce identical cosine similarity", () => {
  const a = [3, 4];
  const b = [6, 8];
  const simRaw = cosineSimilarity(a, b);
  const normA = normalizeEmbedding(a);
  const normB = normalizeEmbedding(b);
  const simNorm = cosineSimilarity(normA, normB);
  assert.ok(Math.abs(simRaw - simNorm) < 1e-6);
  assert.ok(Math.abs(simRaw - 1.0) < 1e-6);
});

test("face-matching-core: Zero vectors return 0.0 without throwing divide-by-zero", () => {
  const zero = [0, 0, 0];
  const v = [1, 2, 3];
  assert.equal(cosineSimilarity(zero, v), 0.0);
  assert.equal(cosineSimilarity(zero, zero), 0.0);
});

test("face-matching-core: Dimension mismatch throws clear error", () => {
  const v1 = [1, 2, 3];
  const v2 = [1, 2];
  assert.throws(() => cosineSimilarity(v1, v2), /Vector length mismatch/);
});

test("face-matching-core: NaN and Infinity are caught and rejected", () => {
  assert.throws(() => validateEmbedding([1, NaN, 3]), /NaN or Infinity/);
  assert.throws(() => validateEmbedding([1, Infinity, 3]), /NaN or Infinity/);
});

test("face-matching-core: findBestMatch honors threshold edges", () => {
  const query = [1, 0, 0];
  const candidatePass = {
    id: "person_1",
    name: "Alice",
    embeddings: [[0.95, 0.31, 0]], // cosine similarity ~0.95
  };
  const candidateFail = {
    id: "person_2",
    name: "Bob",
    embeddings: [[0.2, 0.98, 0]], // cosine similarity ~0.20
  };

  const res1 = findBestMatch(query, [candidatePass, candidateFail], 0.40);
  assert.equal(res1.matched, true);
  assert.equal(res1.candidateId, "person_1");
  assert.equal(res1.candidateName, "Alice");

  // Higher threshold where candidatePass still passes but fails at 0.99
  const resStrict = findBestMatch(query, [candidatePass], 0.99);
  assert.equal(resStrict.matched, false);
  assert.equal(resStrict.candidateId, null);
});

test("face-matching-core: rankMatches correctly orders multiple candidates", () => {
  const query = [1, 0, 0, 0];
  const candidates = [
    { id: "c1", name: "Third", embeddings: [[0.3, 0.95, 0, 0]] },
    { id: "c2", name: "First", embeddings: [[0.99, 0.1, 0, 0]] },
    { id: "c3", name: "Second", embeddings: [[0.7, 0.7, 0, 0]] },
  ];

  const ranked = rankMatches(query, candidates);
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].candidateId, "c2");
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].candidateId, "c3");
  assert.equal(ranked[2].candidateId, "c1");
});

test("face-matching-core: Euclidean distance calculation", () => {
  const p1 = [0, 0];
  const p2 = [3, 4];
  assert.equal(euclideanDistance(p1, p2), 5);
});
