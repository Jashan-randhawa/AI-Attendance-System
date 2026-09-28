import type {
  BoundingBoxInput,
  DetectedFace,
  QualityCheckResult,
  QualityDiagnostics,
  QualityGateThresholds,
} from "./types.js";

export * from "./types.js";

export const DEFAULT_QUALITY_THRESHOLDS: Required<QualityGateThresholds> = {
  minScore: 0.60,
  minFaceWidth: 60,
  minFaceHeight: 60,
  marginRatio: 0.05,
  minEyeDistanceRatio: 0.20,
  maxFacesAllowed: 1,
};

export function parseBoundingBox(bbox: BoundingBoxInput): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
} {
  if (Array.isArray(bbox) && bbox.length >= 4) {
    const x1 = bbox[0];
    const y1 = bbox[1];
    const x2 = bbox[2];
    const y2 = bbox[3];
    return {
      x1,
      y1,
      x2,
      y2,
      width: Math.max(0, x2 - x1),
      height: Math.max(0, y2 - y1),
    };
  } else if (typeof bbox === "object" && bbox !== null && "x" in bbox) {
    const x1 = bbox.x;
    const y1 = bbox.y;
    const width = bbox.width;
    const height = bbox.height;
    return {
      x1,
      y1,
      x2: x1 + width,
      y2: y1 + height,
      width,
      height,
    };
  }
  throw new Error("Invalid bounding box format");
}

/**
 * Evaluates a single detected face against biometric quality gates
 */
export function checkFaceQuality(
  face: DetectedFace,
  imageWidth: number,
  imageHeight: number,
  thresholds: QualityGateThresholds = {}
): QualityCheckResult {
  const activeThresholds = {
    ...DEFAULT_QUALITY_THRESHOLDS,
    ...thresholds,
  };

  const reasons: string[] = [];
  const score = face.score;
  const box = parseBoundingBox(face.bbox);

  // 1. Detection confidence check
  if (score < activeThresholds.minScore) {
    reasons.push(
      `Low detection confidence (${score.toFixed(2)} < ${activeThresholds.minScore.toFixed(2)}). Use better lighting or a clearer photo.`
    );
  }

  // 2. Minimum face size check
  if (box.width < activeThresholds.minFaceWidth || box.height < activeThresholds.minFaceHeight) {
    reasons.push(
      `Face too small (${box.width}x${box.height} px). Minimum required is ${activeThresholds.minFaceWidth}x${activeThresholds.minFaceHeight} px.`
    );
  }

  // 3. Edge margin proximity check
  const marginX = Math.max(Math.floor(imageWidth * activeThresholds.marginRatio), 10);
  const marginY = Math.max(Math.floor(imageHeight * activeThresholds.marginRatio), 10);
  const marginViolation =
    box.x1 < marginX ||
    box.y1 < marginY ||
    box.x2 > imageWidth - marginX ||
    box.y2 > imageHeight - marginY;

  if (marginViolation) {
    reasons.push("Face is too close to the image edge. Center your face in the frame.");
  }

  // 4. Extreme pose / eye distance ratio check
  let eyeDistanceRatio: number | undefined;
  let extremePose = false;

  if (face.kps && Array.isArray(face.kps) && face.kps.length >= 2) {
    const leftEye = face.kps[0];
    const rightEye = face.kps[1];
    if (Array.isArray(leftEye) && Array.isArray(rightEye)) {
      const dx = rightEye[0] - leftEye[0];
      const dy = rightEye[1] - leftEye[1];
      const eyeDist = Math.sqrt(dx * dx + dy * dy);
      if (box.width > 0) {
        eyeDistanceRatio = eyeDist / box.width;
        if (eyeDistanceRatio < activeThresholds.minEyeDistanceRatio) {
          extremePose = true;
          reasons.push("Face appears to be at too extreme an angle. Please face the camera directly.");
        }
      }
    }
  }

  const diagnostics: QualityDiagnostics = {
    score,
    faceWidth: box.width,
    faceHeight: box.height,
    marginViolation,
    eyeDistanceRatio,
    extremePose,
  };

  return {
    isAcceptable: reasons.length === 0,
    reasons,
    diagnostics,
  };
}

/**
 * Validates a list of detected faces from an image frame
 */
export function evaluateFaces(
  faces: DetectedFace[],
  imageWidth: number,
  imageHeight: number,
  thresholds: QualityGateThresholds = {}
): {
  isAcceptable: boolean;
  reasons: string[];
  acceptedFaces: DetectedFace[];
} {
  const activeThresholds = {
    ...DEFAULT_QUALITY_THRESHOLDS,
    ...thresholds,
  };

  if (!faces || faces.length === 0) {
    return {
      isAcceptable: false,
      reasons: ["No face detected in the image. Ensure proper lighting and framing."],
      acceptedFaces: [],
    };
  }

  if (faces.length > activeThresholds.maxFacesAllowed) {
    return {
      isAcceptable: false,
      reasons: [
        `Multiple faces detected (${faces.length}). Only ${activeThresholds.maxFacesAllowed} face is permitted per photo.`,
      ],
      acceptedFaces: [],
    };
  }

  const acceptedFaces: DetectedFace[] = [];
  const allReasons: string[] = [];

  for (const face of faces) {
    const result = checkFaceQuality(face, imageWidth, imageHeight, thresholds);
    if (result.isAcceptable) {
      acceptedFaces.push(face);
    } else {
      allReasons.push(...result.reasons);
    }
  }

  return {
    isAcceptable: acceptedFaces.length > 0 && allReasons.length === 0,
    reasons: allReasons,
    acceptedFaces,
  };
}
