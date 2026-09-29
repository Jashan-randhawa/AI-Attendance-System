export type UserRole = "operator" | "admin";
export interface User {
    id: string;
    username: string;
    email: string | null;
    role: UserRole;
    is_active: boolean;
    created_at: string;
}
export interface AuthToken {
    access_token: string;
    token_type: string;
    role: UserRole;
    username: string;
}
export interface Person {
    id: string;
    name: string;
    email: string | null;
    department: string | null;
    photo_url: string | null;
    enrolled_at: string;
    is_active: boolean;
}
export interface Session {
    id: string;
    label: string;
    department: string | null;
    started_at: string;
    ended_at: string | null;
    is_active: boolean;
}
export interface AttendanceRecord {
    id: string;
    person_id: string;
    person_name: string;
    department: string | null;
    session_id: string;
    session_label: string;
    marked_at: string;
    confidence: number | null;
    status: string;
}
export interface FaceBoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
    [key: string]: unknown;
}
export interface IdentifyResult {
    azure_person_id: string;
    name: string;
    confidence: number;
    face_box: FaceBoundingBox | Record<string, number>;
    already_marked?: boolean;
}
export interface MarkAttendanceResponse {
    session_id: string;
    identified: IdentifyResult[];
    new_records: number;
}
export interface DashboardMetrics {
    total_enrolled: number;
    sessions_today: number;
    present_today: number;
    attendance_rate: number;
}
export interface ActivityItem {
    id: string;
    person_name: string;
    department: string | null;
    session_label: string;
    marked_at: string;
    confidence: number | null;
    status: string;
}
export interface DailyAttendanceStat {
    date: string;
    total_sessions: number;
    total_attendees: number;
    avg_attendance_rate: number;
}
export interface PersonAttendanceRate {
    person_id: string;
    person_name: string;
    department: string | null;
    total_sessions: number;
    attended_sessions: number;
    rate: number;
}
export interface HeatmapItem {
    date: string;
    hour: number;
    count: number;
}
export interface SystemDiagnostics {
    status: string;
    version?: string;
    model_loaded: boolean;
    database_connected: boolean;
    [key: string]: unknown;
}
export interface StorageAdapter {
    getItem: (key: string) => string | null | Promise<string | null>;
    setItem: (key: string, value: string) => void | Promise<void>;
    removeItem: (key: string) => void | Promise<void>;
}
export interface SmartAttendClientOptions {
    baseUrl?: string;
    getAuthToken?: () => string | null | Promise<string | null>;
    setAuthToken?: (token: string | null) => void | Promise<void>;
    apiKey?: string;
    storage?: StorageAdapter;
    fetch?: typeof fetch;
    defaultHeaders?: Record<string, string>;
}
//# sourceMappingURL=types.d.ts.map