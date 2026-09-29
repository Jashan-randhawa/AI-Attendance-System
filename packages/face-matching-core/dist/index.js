export * from "./types.js";
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.40;
export const DEFAULT_DUPLICATE_THRESHOLD = 0.45;
/**
 * Validates vector finiteness and dimension integrity
 */
export function validateEmbedding(v, expectedDim) {
    if (!v || v.length === 0) {
        throw new Error("Embedding vector cannot be empty or null");
    }
    if (expectedDim !== undefined && v.length !== expectedDim) {
        throw new Error(`Embedding dimension mismatch: expected ${expectedDim}, got ${v.length}`);
    }
    for (let i = 0; i < v.length; i++) {
        const val = v[i];
        if (!Number.isFinite(val)) {
            throw new Error(`Embedding contains invalid number (NaN or Infinity) at index ${i}`);
        }
    }
}
/**
 * Computes Euclidean L2 norm of a vector
 */
export function vectorNorm(v) {
    let sumSq = 0;
    for (let i = 0; i < v.length; i++) {
        sumSq += v[i] * v[i];
    }
    return Math.sqrt(sumSq);
}
/**
 * Normalizes vector to unit length (L2 norm = 1.0)
 */
export function normalizeEmbedding(v) {
    validateEmbedding(v);
    const norm = vectorNorm(v);
    const result = new Float32Array(v.length);
    if (norm === 0) {
        return result;
    }
    for (let i = 0; i < v.length; i++) {
        result[i] = v[i] / norm;
    }
    return result;
}
/**
 * Computes cosine similarity between two feature vectors: dot(a, b) / (norm(a) * norm(b))
 * Range: [-1.0, 1.0]. Returns 0.0 for zero vectors.
 */
export function cosineSimilarity(a, b) {
    if (!a || !b)
        return 0.0;
    if (a.length !== b.length) {
        throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        const va = a[i];
        const vb = b[i];
        if (!Number.isFinite(va) || !Number.isFinite(vb)) {
            throw new Error("Cannot calculate similarity: vectors contain NaN or Infinity");
        }
        dot += va * vb;
        normA += va * va;
        normB += vb * vb;
    }
    if (normA === 0 || normB === 0) {
        return 0.0;
    }
    const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.max(-1.0, Math.min(1.0, sim));
}
/**
 * Computes Euclidean distance between two vectors
 */
export function euclideanDistance(a, b) {
    if (!a || !b)
        throw new Error("Vectors cannot be null");
    if (a.length !== b.length) {
        throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
    }
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}
function getCandidateEmbeddings(candidate) {
    if (Array.isArray(candidate.embeddings)) {
        if (candidate.embeddings.length === 0)
            return [];
        if (typeof candidate.embeddings[0] === "number") {
            return [candidate.embeddings];
        }
        return candidate.embeddings;
    }
    return [candidate.embeddings];
}
/**
 * Ranks all candidate enrolled vectors against a probe query vector by descending cosine similarity.
 */
export function rankMatches(query, candidates, options = {}) {
    validateEmbedding(query);
    const threshold = options.threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    const topK = options.topK ?? candidates.length;
    const scoredList = [];
    for (const candidate of candidates) {
        const vectors = getCandidateEmbeddings(candidate);
        let bestScore = -1.0;
        for (const vec of vectors) {
            if (vec.length !== query.length)
                continue;
            const score = cosineSimilarity(query, vec);
            if (score > bestScore) {
                bestScore = score;
            }
        }
        if (bestScore > -1.0) {
            scoredList.push({ candidate, maxScore: bestScore });
        }
    }
    scoredList.sort((a, b) => b.maxScore - a.maxScore);
    return scoredList.slice(0, topK).map((item, idx) => ({
        candidateId: item.candidate.id,
        candidateName: item.candidate.name ?? null,
        score: item.maxScore,
        confidence: Math.max(0, item.maxScore),
        matched: item.maxScore >= threshold,
        rank: idx + 1,
        metadata: item.candidate.metadata,
    }));
}
/**
 * Identifies the best candidate match above a similarity confidence threshold.
 */
export function findBestMatch(query, candidates, threshold = DEFAULT_CONFIDENCE_THRESHOLD) {
    validateEmbedding(query);
    if (!candidates || candidates.length === 0) {
        return {
            matched: false,
            candidateId: null,
            candidateName: null,
            score: 0.0,
            confidence: 0.0,
            threshold,
        };
    }
    const ranked = rankMatches(query, candidates, { threshold, topK: 1 });
    if (ranked.length === 0) {
        return {
            matched: false,
            candidateId: null,
            candidateName: null,
            score: 0.0,
            confidence: 0.0,
            threshold,
        };
    }
    const top = ranked[0];
    const matched = top.score >= threshold;
    return {
        matched,
        candidateId: matched ? top.candidateId : null,
        candidateName: matched ? top.candidateName : null,
        score: top.score,
        confidence: Math.max(0, top.score),
        threshold,
        metadata: top.metadata,
    };
}
//# sourceMappingURL=index.js.map