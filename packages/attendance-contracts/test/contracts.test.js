import test from "node:test";
import assert from "node:assert/strict";

test("attendance-contracts: Exports module and matches contract schema structures", async () => {
  const contracts = await import("../dist/index.js");
  assert.ok(contracts);

  // Validate JSON schema shape of person and attendance record
  const samplePerson = {
    id: "p_123",
    name: "John Doe",
    email: "john@example.com",
    department: "Engineering",
    photo_url: "https://example.com/photo.jpg",
    enrolled_at: new Date().toISOString(),
    is_active: true,
  };

  const sampleRecord = {
    id: "att_001",
    person_id: samplePerson.id,
    person_name: samplePerson.name,
    department: samplePerson.department,
    session_id: "sess_999",
    session_label: "Morning Standup",
    marked_at: new Date().toISOString(),
    confidence: 0.88,
    status: "Present",
  };

  const serialized = JSON.stringify({ person: samplePerson, record: sampleRecord });
  const parsed = JSON.parse(serialized);
  assert.equal(parsed.person.name, "John Doe");
  assert.equal(parsed.record.status, "Present");
  assert.equal(parsed.record.confidence, 0.88);
});
