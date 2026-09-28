# SmartAttend Monorepo & Modular Packages Architecture

SmartAttend is an AI-powered biometric attendance tracking ecosystem. This repository contains the full-stack FastAPI backend and React 18 frontend, alongside a suite of decoupled, standalone libraries published under the `@jashan-randhawa` scope.

---

## Published Packages

| Package | Language | Directory | Description |
| ------- | -------- | --------- | ----------- |
| `@jashan-randhawa/face-matching-core` | TypeScript / JS | `packages/face-matching-core` | Provider-neutral vector normalization, cosine similarity, and top-K candidate matching |
| `@jashan-randhawa/attendance-contracts` | TypeScript / JS | `packages/attendance-contracts` | Shared domain entity schemas and API contracts matching FastAPI Pydantic models |
| `@jashan-randhawa/smartattend-client` | TypeScript / JS | `packages/smartattend-client` | Production-ready typed client SDK for browser, Node.js, and mobile clients |
| `@jashan-randhawa/face-quality-gates` | TypeScript / JS | `packages/face-quality-gates` | Biometric face image quality rules, pose limits, edge margins, and diagnostics |
| `@jashan-randhawa/attendance-domain-core` | TypeScript / JS | `packages/attendance-domain-core` | Database-neutral attendance marking idempotency rules and duplicate classification |
| `smartattend-face-matching` | Python | `packages/python/face-matching-core` | Python vector normalization and cosine similarity matching engine |

---

## Monorepo Layout

```
AI-Attendance-System/
├── LICENSE                         # Monorepo MIT license
├── SECURITY.md                     # Biometric privacy & vulnerability reporting policy
├── package.json                    # Root npm workspace configuration
├── .github/
│   └── workflows/
│       ├── packages-ci.yml         # Automated typechecking, unit tests & tarball smoke tests
│       └── publish-packages.yml    # Automatic publishing to GitHub Packages registry
├── packages/
│   ├── face-matching-core/         # @jashan-randhawa/face-matching-core
│   ├── attendance-contracts/       # @jashan-randhawa/attendance-contracts
│   ├── smartattend-client/         # @jashan-randhawa/smartattend-client
│   ├── face-quality-gates/         # @jashan-randhawa/face-quality-gates
│   ├── attendance-domain-core/     # @jashan-randhawa/attendance-domain-core
│   └── python/
│       └── face-matching-core/     # smartattend-face-matching (Python wheel/sdist)
├── examples/
│   ├── matching-and-quality-demo.js
│   └── client-sdk-demo.js
├── backend/                        # FastAPI + Motor (MongoDB) + InsightFace server
└── frontend/                       # React 18 + Vite + Tailwind CSS dashboard
```

---

## Test Verification

Run all package test suites:
```bash
npm test
```

Or test each package independently:
```bash
cd packages/face-matching-core && npm test
cd packages/attendance-contracts && npm test
cd packages/smartattend-client && npm test
cd packages/face-quality-gates && npm test
cd packages/attendance-domain-core && npm test
```
