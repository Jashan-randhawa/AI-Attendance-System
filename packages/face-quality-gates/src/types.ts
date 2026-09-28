export type BoundingBoxTuple = [number, number, number, number]; // [x1, y1, x2, y2]

export interface BoundingBoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BoundingBoxInput = BoundingBoxTuple | BoundingBoxRect;

export type Keypoint = [number, number];

export interface DetectedFace {
  score: number;
  bbox: BoundingBoxInput;
  kps?: Keypoint[] | number[][];
}

export interface QualityGateThresholds {
  minScore?: number;
  minFaceWidth?: number;
  minFaceHeight?: number;
  marginRatio?: number;
  minEyeDistanceRatio?: number;
  maxFacesAllowed?: number;
}

export interface QualityDiagnostics {
  score: number;
  faceWidth: number;
  faceHeight: number;
  marginViolation: boolean;
  eyeDistanceRatio?: number;
  extremePose: boolean;
}

export interface QualityCheckResult {
  isAcceptable: boolean;
  reasons: string[];
  diagnostics: QualityDiagnostics;
}
