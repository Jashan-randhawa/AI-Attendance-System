# Security Policy & Biometric Data Handling

## Supported Versions

| Package / Component | Version | Supported |
| ------------------- | ------- | --------- |
| `@jashan-randhawa/face-matching-core` | `^1.0.0` | :white_check_mark: |
| `@jashan-randhawa/attendance-contracts` | `^1.0.0` | :white_check_mark: |
| `@jashan-randhawa/smartattend-client` | `^1.0.0` | :white_check_mark: |
| `@jashan-randhawa/face-quality-gates` | `^1.0.0` | :white_check_mark: |
| `@jashan-randhawa/attendance-domain-core` | `^1.0.0` | :white_check_mark: |
| `smartattend-face-matching` (Python) | `^1.0.0` | :white_check_mark: |

---

## Biometric Data & Privacy Notice

Face images, feature vectors, and embeddings constitute sensitive biometric data under GDPR, CCPA, and applicable privacy regulations:
1. **No Implicit Retention**: Reusable matching libraries in this monorepo process vectors in memory only and never retain or transmit biometric data to third-party endpoints.
2. **Threshold Calibration**: Cosine similarity thresholds (e.g. `0.40` for identification, `0.45` for duplicate prevention) are application-specific calibration parameters and do not represent universal guarantees across differing optical sensors, lighting environments, or camera angles.
3. **Opt-in Storage**: Enrolling deployments must maintain encrypted storage, access logs, and automated data-retention expiration policies for biometric face encodings.

---

## Reporting a Vulnerability

If you discover a security vulnerability or unauthorized credential leak, please report it privately:
1. Open a Private Security Advisory at [https://github.com/Jashan-randhawa/AI-Attendance-System/security/advisories/new](https://github.com/Jashan-randhawa/AI-Attendance-System/security/advisories/new).
2. Or contact the maintainer directly at `jashanrandhawa76@gmail.com`.

We acknowledge reports within 48 hours and coordinate prompt remediation releases.
