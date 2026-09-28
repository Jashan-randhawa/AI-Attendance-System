// ── User & Auth ────────────────────────────────────────────────────────────────
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

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
  email?: string | null;
  role?: UserRole;
}

// ── Person ────────────────────────────────────────────────────────────────────
export interface PersonCreate {
  name: string;
  email?: string | null;
  department?: string | null;
}

export interface Person {
  id: string;
  name: string;
  email: string | null;
  department: string | null;
  photo_url: string | null;
  enrolled_at: string;
  is_active: boolean;
  enrolled_by?: string | null;
}

export type PersonOut = Person;

// ── Session ───────────────────────────────────────────────────────────────────
export interface SessionCreate {
  label: string;
  department?: string | null;
}

export interface Session {
  id: string;
  label: string;
  department: string | null;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
}

export type SessionOut = Session;

// ── Attendance ────────────────────────────────────────────────────────────────
export type AttendanceStatus = "Present" | "Late" | "Absent" | "Excused";

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
  marked_by?: string | null;
}

export type AttendanceOut = AttendanceRecord;

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

// ── Dashboard ─────────────────────────────────────────────────────────────────
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

// ── Reports ───────────────────────────────────────────────────────────────────
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

// ── System Diagnostics ────────────────────────────────────────────────────────
export interface SystemDiagnostics {
  status: string;
  version?: string;
  model_loaded: boolean;
  database_connected: boolean;
  total_encodings_cached?: number;
  uptime_seconds?: number;
}
