# @jashan-randhawa/smartattend-client

> Production-ready typed client SDK for the Smart Attendance FastAPI backend, supporting Node.js, browsers, and mobile runtimes.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

`@jashan-randhawa/smartattend-client` provides a robust, strongly-typed HTTP client for consuming the Smart Attendance API across web applications, administrative dashboards, kiosk devices, and background scripts.

Features:
- Unified modules: `auth`, `persons`, `sessions`, `attendance`, `dashboard`, `reports`, and `diagnostics`
- Automatic JWT Bearer token injection with support for legacy `X-API-Key`
- Pluggable storage adapters (memory, sessionStorage, localStorage, or custom)
- Automatic FormData multipart handling for biometric face photos
- Clean, structured error handling via `ApiError`

---

## Installation

```bash
# Via GitHub Packages
npm install @jashan-randhawa/smartattend-client
```

Ensure your `.npmrc` is configured for the `@jashan-randhawa` scope:
```ini
@jashan-randhawa:registry=https://npm.pkg.github.com
```

---

## Quick Start

```ts
import { SmartAttendClient } from "@jashan-randhawa/smartattend-client";

const client = new SmartAttendClient({
  baseUrl: "https://api.smartattend.example.com",
});

// 1. Authenticate operator or administrator
const auth = await client.auth.login("operator_user", "SecurePassword123!");
console.log(`Logged in as ${auth.username} (${auth.role})`);

// 2. Query active sessions
const sessions = await client.sessions.list({ active_only: true });

// 3. Mark attendance with a captured camera frame
const attendanceReport = await client.attendance.mark({
  session_id: sessions[0].id,
  photo: capturedImageBlob,
});

console.log(`Marked ${attendanceReport.new_records} attendees.`);
```

---

## API Reference

- `client.auth.login(username, password)`
- `client.auth.me()`
- `client.persons.list(query?)`
- `client.persons.get(personId)`
- `client.persons.enroll({ name, email?, department?, photos })`
- `client.persons.delete(personId)`
- `client.sessions.create({ label, department? })`
- `client.sessions.list(query?)`
- `client.sessions.end(sessionId)`
- `client.attendance.identify(photoBlob)`
- `client.attendance.mark({ session_id, photo })`
- `client.attendance.list(query?)`
- `client.attendance.exportCsv(sessionId?)`
- `client.dashboard.getMetrics()`
- `client.reports.getDailyStats(days?)`

---

## License

MIT © [Jashan Randhawa](https://github.com/Jashan-randhawa)
