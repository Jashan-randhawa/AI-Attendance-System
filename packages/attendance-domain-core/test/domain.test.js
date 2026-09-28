import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldMarkAttendance,
  classifyDuplicate,
  validateSessionState,
  filterNewAttendees,
  buildAttendanceDraft,
} from "../dist/index.js";

test("attendance-domain-core: First mark is approved", () => {
  const existing = [];
  const decision = shouldMarkAttendance(existing, "p1", "s1");
  assert.equal(decision.action, "MARK");
  assert.equal(decision.shouldRecord, true);
});

test("attendance-domain-core: Duplicate mark in same session is ignored", () => {
  const existing = [
    { person_id: "p1", session_id: "s1", marked_at: "2026-09-28T09:00:00Z" },
  ];

  const decision = shouldMarkAttendance(existing, "p1", "s1");
  assert.equal(decision.action, "IGNORE_DUPLICATE");
  assert.equal(decision.shouldRecord, false);
  assert.equal(decision.existingRecord?.person_id, "p1");
});

test("attendance-domain-core: Same person in different session is permitted", () => {
  const existing = [
    { person_id: "p1", session_id: "s1", marked_at: "2026-09-28T09:00:00Z" },
  ];

  const decision = shouldMarkAttendance(existing, "p1", "s2");
  assert.equal(decision.action, "MARK");
  assert.equal(decision.shouldRecord, true);
});

test("attendance-domain-core: Closed session is rejected", () => {
  const existing = [];
  const closedSession = {
    id: "s1",
    label: "Completed Session",
    is_active: false,
    ended_at: "2026-09-28T10:00:00Z",
  };

  const decision = shouldMarkAttendance(existing, "p1", "s1", closedSession);
  assert.equal(decision.action, "REJECT_SESSION_CLOSED");
  assert.equal(decision.shouldRecord, false);
});

test("attendance-domain-core: Missing or invalid person identifier is rejected", () => {
  const decision = shouldMarkAttendance([], "", "s1");
  assert.equal(decision.action, "REJECT_INVALID_PERSON");
  assert.equal(decision.shouldRecord, false);
});

test("attendance-domain-core: classifyDuplicate categorizes immediate retries vs spaced duplicates", () => {
  const baseTime = new Date("2026-09-28T09:00:00Z");
  const existing = { person_id: "p1", session_id: "s1", marked_at: baseTime.toISOString() };

  // 5 seconds later: IMMEDIATE_RETRY
  const immediate = classifyDuplicate(existing, new Date(baseTime.getTime() + 5000));
  assert.equal(immediate.isDuplicate, true);
  assert.equal(immediate.classification, "IMMEDIATE_RETRY");

  // 10 minutes later: SAME_SESSION_DUPLICATE
  const spaced = classifyDuplicate(existing, new Date(baseTime.getTime() + 600000));
  assert.equal(spaced.classification, "SAME_SESSION_DUPLICATE");
  assert.equal(spaced.elapsedSeconds, 600);
});

test("attendance-domain-core: filterNewAttendees filters out already marked candidates", () => {
  const existing = [
    { person_id: "p1", session_id: "s1", marked_at: new Date() },
    { person_id: "p2", session_id: "s1", marked_at: new Date() },
  ];

  const candidates = ["p1", "p2", "p3", "p4", "p3"];
  const newOnes = filterNewAttendees(candidates, "s1", existing);
  assert.deepEqual(newOnes, ["p3", "p4"]);
});

test("attendance-domain-core: buildAttendanceDraft creates standard draft record", () => {
  const draft = buildAttendanceDraft({
    person_id: "p99",
    person_name: "Sarah Connor",
    session_id: "s88",
    session_label: "Defense Training",
    confidence: 0.94,
  });

  assert.equal(draft.person_name, "Sarah Connor");
  assert.equal(draft.confidence, 0.94);
  assert.equal(draft.status, "Present");
  assert.ok(draft.marked_at);
});
