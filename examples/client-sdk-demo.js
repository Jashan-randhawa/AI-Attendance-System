/**
 * Example demonstrating @jashan-randhawa/smartattend-client and @jashan-randhawa/attendance-domain-core
 */
import {
  SmartAttendClient,
} from "../packages/smartattend-client/dist/index.js";

import {
  shouldMarkAttendance,
  classifyDuplicate,
} from "../packages/attendance-domain-core/dist/index.js";

console.log("=== SmartAttend Client SDK & Domain Idempotency Demo ===\n");

// 1. Domain Idempotency Decision
const existingSessionRecords = [
  { person_id: "p_101", session_id: "sess_math_1", marked_at: "2026-09-28T09:00:00Z" },
];

const decision1 = shouldMarkAttendance(existingSessionRecords, "p_101", "sess_math_1");
console.log("1. Idempotency Check for p_101 in sess_math_1:");
console.log(`   action: ${decision1.action}`);
console.log(`   shouldRecord: ${decision1.shouldRecord}`);
console.log(`   reason: ${decision1.reason}`);

if (decision1.action === "IGNORE_DUPLICATE") {
  const telemetry = classifyDuplicate(decision1.existingRecord, "2026-09-28T09:05:00Z");
  console.log(`   duplicate classification: ${telemetry.classification} (after ${telemetry.elapsedSeconds}s)`);
}

// 2. New attendee check
const decision2 = shouldMarkAttendance(existingSessionRecords, "p_102", "sess_math_1");
console.log("\n2. Idempotency Check for p_102 (new attendee):");
console.log(`   action: ${decision2.action}`);
console.log(`   shouldRecord: ${decision2.shouldRecord}`);

// 3. Client SDK Instantiation
const client = new SmartAttendClient({
  baseUrl: "https://api.smartattend.example.com",
  apiKey: "demo_api_key_123",
});

console.log("\n3. Client SDK initialized:");
console.log(`   Base URL configured: https://api.smartattend.example.com`);
console.log(`   Client modules ready: auth, persons, sessions, attendance, dashboard, reports`);

console.log("\nDemo completed successfully!");
