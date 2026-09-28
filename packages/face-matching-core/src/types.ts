export type EmbeddingVector = number[] | Float32Array | Float64Array;

export interface MatchCandidate {
  id: string;
  name?: string;
  embeddings: EmbeddingVector[] | EmbeddingVector;
  metadata?: Record<string, unknown>;
}

export interface MatchResult {
  matched: boolean;
  candidateId: string | null;
  candidateName: string | null;
  score: number;
  confidence: number;
  threshold: number;
  metadata?: Record<string, unknown>;
}

export interface RankedMatch {
  candidateId: string;
  candidateName: string | null;
  score: number;
  matched: boolean;
  rank: number;
  metadata?: Record<string, unknown>;
}

export interface MatchingOptions {
  threshold?: number;
  topK?: number;
  requireNormalized?: boolean;
}
