export interface AttendanceRecordLike {
    id?: string;
    person_id: string;
    session_id: string;
    marked_at: string | Date;
    confidence?: number | null;
    status?: string;
    [key: string]: unknown;
}
export interface SessionLike {
    id: string;
    label: string;
    is_active: boolean;
    started_at?: string | Date;
    ended_at?: string | Date | null;
    department?: string | null;
}
export type DecisionAction = "MARK" | "IGNORE_DUPLICATE" | "REJECT_SESSION_CLOSED" | "REJECT_INVALID_PERSON";
export interface AttendanceDecision {
    action: DecisionAction;
    shouldRecord: boolean;
    reason: string;
    existingRecord?: AttendanceRecordLike;
}
export type DuplicateClassificationType = "IMMEDIATE_RETRY" | "SAME_SESSION_DUPLICATE" | "NOT_DUPLICATE";
export interface DuplicateClassification {
    isDuplicate: boolean;
    originalMarkedAt: string | Date;
    elapsedSeconds: number;
    classification: DuplicateClassificationType;
}
export interface AttendanceDraft {
    person_id: string;
    person_name: string;
    department?: string | null;
    session_id: string;
    session_label: string;
    marked_at: string;
    confidence?: number | null;
    status: string;
    marked_by?: string | null;
}
//# sourceMappingURL=types.d.ts.map