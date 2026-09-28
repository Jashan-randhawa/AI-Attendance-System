/**
 * Example demonstrating @jashan-randhawa/face-matching-core and @jashan-randhawa/face-quality-gates
 */
import {
  cosineSimilarity,
  findBestMatch,
  normalizeEmbedding,
} from "../packages/face-matching-core/dist/index.js";

import {
  checkFaceQuality,
  evaluateFaces,
} from "../packages/face-quality-gates/dist/index.js";

console.log("=== Face Quality Gates & Matching Core Demo ===\n");

// 1. Biometric Quality Gate Check
const cameraDetectedFace = {
  score: 0.94,
  bbox: [220, 180, 520, 560], // 300x380 px in 1280x720 frame
  kps: [
    [320, 310], // Left eye
    [430, 310], // Right eye (dist = 110 px; ratio = 110/300 = 0.36 > 0.20)
  ],
};

const qualityResult = checkFaceQuality(cameraDetectedFace, 1280, 720);
console.log("1. Quality Gate Result:");
console.log(`   isAcceptable: ${qualityResult.isAcceptable}`);
console.log(`   face dimensions: ${qualityResult.diagnostics.faceWidth}x${qualityResult.diagnostics.faceHeight} px`);
console.log(`   detection score: ${qualityResult.diagnostics.score}`);

// 2. Vector Cosine Similarity
const enrolledAlice = normalizeEmbedding([0.04, 0.77, -0.21, 0.44]);
const probeFrame = normalizeEmbedding([0.05, 0.79, -0.20, 0.42]);
const enrolledBob = normalizeEmbedding([-0.30, 0.12, 0.65, -0.11]);

const similarityAlice = cosineSimilarity(probeFrame, enrolledAlice);
const similarityBob = cosineSimilarity(probeFrame, enrolledBob);

console.log("\n2. Similarity Comparison:");
console.log(`   Probe vs Alice: ${(similarityAlice * 100).toFixed(1)}%`);
console.log(`   Probe vs Bob:   ${(similarityBob * 100).toFixed(1)}%`);

// 3. Best Match Identification
const candidates = [
  { id: "usr_alice", name: "Alice Johnson", embeddings: [enrolledAlice] },
  { id: "usr_bob", name: "Bob Smith", embeddings: [enrolledBob] },
];

const match = findBestMatch(probeFrame, candidates, 0.40);
console.log("\n3. Gallery Identification:");
if (match.matched) {
  console.log(`   Matched Candidate: ${match.candidateName} (ID: ${match.candidateId})`);
  console.log(`   Confidence Score:  ${match.score.toFixed(3)}`);
} else {
  console.log("   No candidate matched above threshold.");
}

console.log("\nDemo completed successfully!");
