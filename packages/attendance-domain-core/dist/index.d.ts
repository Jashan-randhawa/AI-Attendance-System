import type { AttendanceDecision, AttendanceDraft, AttendanceRecordLike, DuplicateClassification, SessionLike } from "./types.js";
export * from "./types.js";
/**
 * Validates whether a target session is active and currently eligible for attendance intake.
 */
export declare function validateSessionState(session: SessionLike): {
    canMark: boolean;
    reason?: string;
};
/**
 * Classifies an incoming mark event against a previous record for duplicate detection telemetry
 */
export declare function classifyDuplicate(existingRecord: AttendanceRecordLike, currentTimestamp?: string | Date): DuplicateClassification;
/**
 * Evaluates whether an attendance record should be created for a person in a session,
 * enforcing database-neutral idempotency.
 */
export declare function shouldMarkAttendance(existingRecords: AttendanceRecordLike[], personId: string, sessionId: string, session?: SessionLike): AttendanceDecision;
/**
 * Filters a list of candidate person IDs, returning only those not yet marked in the session
 */
export declare function filterNewAttendees(candidatePersonIds: string[], sessionId: string, existingSessionRecords: AttendanceRecordLike[]): string[];
/**
 * Constructs a normalized attendance draft object
 */
export declare function buildAttendanceDraft(params: {
    person_id: string;
    person_name: string;
    department?: string | null;
    session_id: string;
    session_label: string;
    confidence?: number | null;
    status?: string;
    marked_by?: string | null;
    marked_at?: string | Date;
}): AttendanceDraft;
//# sourceMappingURL=index.d.ts.map