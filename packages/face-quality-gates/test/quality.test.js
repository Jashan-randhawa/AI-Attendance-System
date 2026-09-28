import test from "node:test";
import assert from "node:assert/strict";
import {
  checkFaceQuality,
  evaluateFaces,
  parseBoundingBox,
} from "../dist/index.js";

test("face-quality-gates: Valid face passes quality gate", () => {
  const goodFace = {
    score: 0.92,
    bbox: [200, 200, 450, 500], // 250x300 px
    kps: [
      [280, 320], // Left eye
      [370, 320], // Right eye (dist = 90px; ratio = 90/250 = 0.36 > 0.20)
    ],
  };

  const result = checkFaceQuality(goodFace, 1280, 720);
  assert.equal(result.isAcceptable, true);
  assert.equal(result.reasons.length, 0);
  assert.equal(result.diagnostics.marginViolation, false);
  assert.equal(result.diagnostics.extremePose, false);
});

test("face-quality-gates: Low confidence score rejected", () => {
  const lowScoreFace = {
    score: 0.52,
    bbox: [200, 200, 450, 500],
  };

  const result = checkFaceQuality(lowScoreFace, 1280, 720);
  assert.equal(result.isAcceptable, false);
  assert.ok(result.reasons.some((r) => r.includes("Low detection confidence")));
});

test("face-quality-gates: Small face rejected (<60px)", () => {
  const tinyFace = {
    score: 0.85,
    bbox: [100, 100, 140, 140], // 40x40 px
  };

  const result = checkFaceQuality(tinyFace, 1280, 720);
  assert.equal(result.isAcceptable, false);
  assert.ok(result.reasons.some((r) => r.includes("Face too small")));
});

test("face-quality-gates: Edge margin violation rejected", () => {
  const edgeFace = {
    score: 0.88,
    bbox: [5, 200, 250, 450], // x1 = 5 px, violates 5% margin of 1280 (64 px)
  };

  const result = checkFaceQuality(edgeFace, 1280, 720);
  assert.equal(result.isAcceptable, false);
  assert.ok(result.reasons.some((r) => r.includes("too close to the image edge")));
  assert.equal(result.diagnostics.marginViolation, true);
});

test("face-quality-gates: Extreme pose rejected (eye distance ratio < 0.20)", () => {
  const profileFace = {
    score: 0.88,
    bbox: [200, 200, 400, 400], // width = 200 px
    kps: [
      [250, 300],
      [270, 300], // eye distance = 20 px, ratio = 20/200 = 0.10 < 0.20
    ],
  };

  const result = checkFaceQuality(profileFace, 1280, 720);
  assert.equal(result.isAcceptable, false);
  assert.ok(result.reasons.some((r) => r.includes("too extreme an angle")));
  assert.equal(result.diagnostics.extremePose, true);
});

test("face-quality-gates: evaluateFaces handles no face and multiple faces", () => {
  const noFacesResult = evaluateFaces([], 1280, 720);
  assert.equal(noFacesResult.isAcceptable, false);
  assert.ok(noFacesResult.reasons[0].includes("No face detected"));

  const multipleFacesResult = evaluateFaces(
    [
      { score: 0.9, bbox: [100, 100, 300, 300] },
      { score: 0.9, bbox: [400, 100, 600, 300] },
    ],
    1280,
    720
  );
  assert.equal(multipleFacesResult.isAcceptable, false);
  assert.ok(multipleFacesResult.reasons[0].includes("Multiple faces detected"));
});

test("face-quality-gates: parseBoundingBox supports both tuple and rect formats", () => {
  const tuple = parseBoundingBox([10, 20, 110, 120]);
  assert.equal(tuple.width, 100);
  assert.equal(tuple.height, 100);

  const rect = parseBoundingBox({ x: 10, y: 20, width: 80, height: 90 });
  assert.equal(rect.x2, 90);
  assert.equal(rect.y2, 110);
});
