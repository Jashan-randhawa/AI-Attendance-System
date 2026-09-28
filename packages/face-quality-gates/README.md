# @jashan-randhawa/face-quality-gates

> Biometric face image quality evaluation rules, pose limits, edge margin checks, and quality gate diagnostics.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

In facial recognition intake pipelines (such as enrollment or kiosk check-in), poor quality inputs lead to false rejections or high identification latency.

`@jashan-randhawa/face-quality-gates` provides zero-dependency quality gate heuristics:
- **Detection Confidence Floor**: Discards low-confidence false positives
- **Minimum Dimensions**: Ensures sufficient pixel density for feature extraction
- **Edge Margin Guard**: Rejects faces clipped by camera image boundaries
- **Pose Angle & Keypoint Checks**: Detects extreme side profiles using eye distance ratios
- **Multi-Face Guards**: Rejects photos containing multiple faces in single-person enrollment

---

## Installation

```bash
# Via GitHub Packages
npm install @jashan-randhawa/face-quality-gates
```

Ensure your `.npmrc` is configured for the `@jashan-randhawa` scope:
```ini
@jashan-randhawa:registry=https://npm.pkg.github.com
```

---

## Quick Start

```ts
import { checkFaceQuality, evaluateFaces } from "@jashan-randhawa/face-quality-gates";

const detectedFace = {
  score: 0.94,
  bbox: [150, 120, 380, 420], // [x1, y1, x2, y2]
  kps: [[220, 240], [310, 240]], // Eye keypoints
};

const result = checkFaceQuality(detectedFace, 1280, 720);

if (!result.isAcceptable) {
  console.warn("Quality gate failure:", result.reasons);
} else {
  console.log("Face passed biometric quality checks.");
}
```

---

## API Reference

### `checkFaceQuality(face, imageWidth, imageHeight, thresholds?)`
Evaluates a single detected face against quality criteria. Returns `QualityCheckResult`.

### `evaluateFaces(faces, imageWidth, imageHeight, thresholds?)`
Validates list of detected faces in an image frame (including multi-face constraints).

---

## License

MIT © [Jashan Randhawa](https://github.com/Jashan-randhawa)
