# @jashan-randhawa/attendance-domain-core

> Database-neutral attendance marking idempotency rules, session status validation, and duplicate event classification.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Prevents double-marking race conditions and encapsulates session lifecycle rules away from database queries.

Features:
- Pure attendance decision engine: `shouldMarkAttendance(existing, personId, sessionId, session?)`
- Duplicate classification telemetry (`IMMEDIATE_RETRY` vs `SAME_SESSION_DUPLICATE`)
- Session status and expiration validation
- Bulk attendee de-duplication: `filterNewAttendees()`
- Zero database or framework dependencies

---

## Installation

```bash
# Via GitHub Packages
npm install @jashan-randhawa/attendance-domain-core
```

Ensure your `.npmrc` is configured for the `@jashan-randhawa` scope:
```ini
@jashan-randhawa:registry=https://npm.pkg.github.com
```

---

## Quick Start

```ts
import {
  shouldMarkAttendance,
  classifyDuplicate
} from "@jashan-randhawa/attendance-domain-core";

const existingRecords = [
  { person_id: "usr_1", session_id: "sess_A", marked_at: "2026-09-28T09:00:00Z" }
];

const decision = shouldMarkAttendance(existingRecords, "usr_1", "sess_A");

if (decision.action === "IGNORE_DUPLICATE") {
  const telemetry = classifyDuplicate(decision.existingRecord!);
  console.log(`Duplicate detected (${telemetry.classification})`);
} else if (decision.shouldRecord) {
  console.log("Valid attendee, proceed to persist in database.");
}
```

---

## API Reference

### `shouldMarkAttendance(existingRecords, personId, sessionId, session?)`
Returns `AttendanceDecision` with `action: "MARK" | "IGNORE_DUPLICATE" | "REJECT_SESSION_CLOSED" | "REJECT_INVALID_PERSON"`.

### `classifyDuplicate(existingRecord, currentTimestamp?)`
Returns `DuplicateClassification` detailing elapsed duration and duplicate reason.

### `validateSessionState(session)`
Checks whether a session is active and not yet closed.

### `filterNewAttendees(candidatePersonIds, sessionId, existingRecords)`
Returns array of unique person IDs who have not yet been marked in the target session.

---

## License

MIT © [Jashan Randhawa](https://github.com/Jashan-randhawa)
