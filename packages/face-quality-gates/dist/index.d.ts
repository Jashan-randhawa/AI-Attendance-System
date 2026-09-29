import type { BoundingBoxInput, DetectedFace, QualityCheckResult, QualityGateThresholds } from "./types.js";
export * from "./types.js";
export declare const DEFAULT_QUALITY_THRESHOLDS: Required<QualityGateThresholds>;
export declare function parseBoundingBox(bbox: BoundingBoxInput): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    height: number;
};
/**
 * Evaluates a single detected face against biometric quality gates
 */
export declare function checkFaceQuality(face: DetectedFace, imageWidth: number, imageHeight: number, thresholds?: QualityGateThresholds): QualityCheckResult;
/**
 * Validates a list of detected faces from an image frame
 */
export declare function evaluateFaces(faces: DetectedFace[], imageWidth: number, imageHeight: number, thresholds?: QualityGateThresholds): {
    isAcceptable: boolean;
    reasons: string[];
    acceptedFaces: DetectedFace[];
};
//# sourceMappingURL=index.d.ts.map