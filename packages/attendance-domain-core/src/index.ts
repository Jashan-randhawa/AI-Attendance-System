import type {
  AttendanceDecision,
  AttendanceDraft,
  AttendanceRecordLike,
  DuplicateClassification,
  SessionLike,
} from "./types.js";

export * from "./types.js";

/**
 * Validates whether a target session is active and currently eligible for attendance intake.
 */
export function validateSessionState(session: SessionLike): { canMark: boolean; reason?: string } {
  if (!session) {
    return { canMark: false, reason: "Session does not exist" };
  }
  if (!session.is_active || session.ended_at) {
    return {
      canMark: false,
      reason: `Session '${session.label || session.id}' is closed and no longer accepting attendance`,
    };
  }
  return { canMark: true };
}

/**
 * Classifies an incoming mark event against a previous record for duplicate detection telemetry
 */
export function classifyDuplicate(
  existingRecord: AttendanceRecordLike,
  currentTimestamp: string | Date = new Date()
): DuplicateClassification {
  const origTime = new Date(existingRecord.marked_at).getTime();
  const currTime = new Date(currentTimestamp).getTime();
  const elapsedSeconds = Math.max(0, Math.floor((currTime - origTime) / 1000));

  let classification: "IMMEDIATE_RETRY" | "SAME_SESSION_DUPLICATE" = "SAME_SESSION_DUPLICATE";
  if (elapsedSeconds <= 15) {
    classification = "IMMEDIATE_RETRY";
  }

  return {
    isDuplicate: true,
    originalMarkedAt: existingRecord.marked_at,
    elapsedSeconds,
    classification,
  };
}

/**
 * Evaluates whether an attendance record should be created for a person in a session,
 * enforcing database-neutral idempotency.
 */
export function shouldMarkAttendance(
  existingRecords: AttendanceRecordLike[],
  personId: string,
  sessionId: string,
  session?: SessionLike
): AttendanceDecision {
  if (!personId || typeof personId !== "string" || personId.trim() === "") {
    return {
      action: "REJECT_INVALID_PERSON",
      shouldRecord: false,
      reason: "Missing or invalid person identifier",
    };
  }

  if (session) {
    const sessionValidation = validateSessionState(session);
    if (!sessionValidation.canMark) {
      return {
        action: "REJECT_SESSION_CLOSED",
        shouldRecord: false,
        reason: sessionValidation.reason!,
      };
    }
  }

  const existing = existingRecords.find(
    (r) => String(r.person_id) === String(personId) && String(r.session_id) === String(sessionId)
  );

  if (existing) {
    return {
      action: "IGNORE_DUPLICATE",
      shouldRecord: false,
      reason: `Person ${personId} has already been recorded for session ${sessionId}`,
      existingRecord: existing,
    };
  }

  return {
    action: "MARK",
    shouldRecord: true,
    reason: "New valid attendee for this session",
  };
}

/**
 * Filters a list of candidate person IDs, returning only those not yet marked in the session
 */
export function filterNewAttendees(
  candidatePersonIds: string[],
  sessionId: string,
  existingSessionRecords: AttendanceRecordLike[]
): string[] {
  const markedSet = new Set(
    existingSessionRecords
      .filter((r) => String(r.session_id) === String(sessionId))
      .map((r) => String(r.person_id))
  );

  return Array.from(new Set(candidatePersonIds.filter((pid) => !markedSet.has(String(pid)))));
}

/**
 * Constructs a normalized attendance draft object
 */
export function buildAttendanceDraft(params: {
  person_id: string;
  person_name: string;
  department?: string | null;
  session_id: string;
  session_label: string;
  confidence?: number | null;
  status?: string;
  marked_by?: string | null;
  marked_at?: string | Date;
}): AttendanceDraft {
  return {
    person_id: params.person_id,
    person_name: params.person_name,
    department: params.department ?? null,
    session_id: params.session_id,
    session_label: params.session_label,
    confidence: params.confidence ?? null,
    status: params.status ?? "Present",
    marked_by: params.marked_by ?? null,
    marked_at: params.marked_at ? new Date(params.marked_at).toISOString() : new Date().toISOString(),
  };
}
