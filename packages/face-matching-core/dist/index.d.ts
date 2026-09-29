import type { EmbeddingVector, MatchCandidate, MatchingOptions, MatchResult, RankedMatch } from "./types.js";
export * from "./types.js";
export declare const DEFAULT_CONFIDENCE_THRESHOLD = 0.4;
export declare const DEFAULT_DUPLICATE_THRESHOLD = 0.45;
/**
 * Validates vector finiteness and dimension integrity
 */
export declare function validateEmbedding(v: EmbeddingVector, expectedDim?: number): void;
/**
 * Computes Euclidean L2 norm of a vector
 */
export declare function vectorNorm(v: EmbeddingVector): number;
/**
 * Normalizes vector to unit length (L2 norm = 1.0)
 */
export declare function normalizeEmbedding(v: EmbeddingVector): Float32Array;
/**
 * Computes cosine similarity between two feature vectors: dot(a, b) / (norm(a) * norm(b))
 * Range: [-1.0, 1.0]. Returns 0.0 for zero vectors.
 */
export declare function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number;
/**
 * Computes Euclidean distance between two vectors
 */
export declare function euclideanDistance(a: EmbeddingVector, b: EmbeddingVector): number;
/**
 * Ranks all candidate enrolled vectors against a probe query vector by descending cosine similarity.
 */
export declare function rankMatches(query: EmbeddingVector, candidates: MatchCandidate[], options?: MatchingOptions): RankedMatch[];
/**
 * Identifies the best candidate match above a similarity confidence threshold.
 */
export declare function findBestMatch(query: EmbeddingVector, candidates: MatchCandidate[], threshold?: number): MatchResult;
//# sourceMappingURL=index.d.ts.map