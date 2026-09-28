# @jashan-randhawa/attendance-contracts

> Shared TypeScript and JavaScript domain types, entity schemas, and API payload contracts for SmartAttend.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Eliminates schema drift between FastAPI Pydantic v2 schemas and frontend TypeScript consumers.

Features:
- Type-safe contracts matching backend models for:
  - `User`, `AuthToken`, `LoginPayload`
  - `Person`, `PersonCreate`
  - `Session`, `SessionCreate`
  - `AttendanceRecord`, `IdentifyResult`, `MarkAttendanceResponse`
  - `DashboardMetrics`, `ActivityItem`
  - `DailyAttendanceStat`, `PersonAttendanceRate`, `HeatmapItem`
  - `SystemDiagnostics`
- Zero runtime dependencies

---

## Installation

```bash
# Via GitHub Packages
npm install @jashan-randhawa/attendance-contracts
```

Ensure your `.npmrc` is configured for the `@jashan-randhawa` scope:
```ini
@jashan-randhawa:registry=https://npm.pkg.github.com
```

---

## Usage

```ts
import type {
  Person,
  Session,
  AttendanceRecord,
  IdentifyResult
} from "@jashan-randhawa/attendance-contracts";

function processIdentification(result: IdentifyResult) {
  console.log(`Matched person: ${result.name} (confidence: ${result.confidence})`);
}
```

---

## License

MIT © [Jashan Randhawa](https://github.com/Jashan-randhawa)
