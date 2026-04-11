/**
 * src/services/api.ts
 * Centralised API client for the Smart Attendance backend.
 * All components should import from here — never use fetch() directly.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ── Generic fetch wrapper ─────────────────────────────────────────────────────
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...("body" in options && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Types (mirror core/schemas.py) ───────────────────────────────────────────
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
  id: string;          // MongoDB ObjectId string
  label: string;
  department: string | null;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
}

export interface AttendanceRecord {
  id: string;          // MongoDB ObjectId string
  person_id: string;
  person_name: string;
  department: string | null;
  session_id: string;  // MongoDB ObjectId string
  session_label: string;
  marked_at: string;
  confidence: number | null;
  status: string;
}

export interface IdentifyResult {
  azure_person_id: string;
  name: string;
  confidence: number;
  face_box: { top: number; left: number; width: number; height: number };
  already_marked: boolean;
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
  total_present: number;
  attendance_rate: number;
}

export interface PersonAttendanceStat {
  person_id: string;
  name: string;
  department: string | null;
  total_sessions: number;
  present_count: number;
  attendance_rate: number;
  is_defaulter: boolean;
}

export interface HeatmapData {
  dates: string[];
  persons: Array<{
    person_id: string;
    name: string;
    department: string | null;
    data: Array<0 | 1 | null>;
  }>;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  getMetrics: () => request<DashboardMetrics>("/api/dashboard/metrics"),
  getActivity: () => request<ActivityItem[]>("/api/dashboard/activity"),
};

// ── Persons ───────────────────────────────────────────────────────────────────
export const personsApi = {
  list: () => request<Person[]>("/api/persons"),
  get: (id: string) => request<Person>(`/api/persons/${id}`),
  enroll: (formData: FormData) =>
    request<Person>("/api/persons/enroll", { method: "POST", body: formData }),
  analyzePhotos: (formData: FormData) =>
    request<unknown>("/api/persons/enroll/analyze", { method: "POST", body: formData }),
  delete: (id: string) =>
    request<void>(`/api/persons/${id}`, { method: "DELETE" }),
};

// ── Sessions ──────────────────────────────────────────────────────────────────
export const sessionsApi = {
  list: (active?: boolean) => {
    const qs = active !== undefined ? `?active=${active}` : "";
    return request<Session[]>(`/api/sessions${qs}`);
  },
  create: (label: string, department?: string) =>
    request<Session>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ label, department }),
    }),
  end: (id: string) =>
    request<Session>(`/api/sessions/${id}/end`, { method: "PATCH" }),
};

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceApi = {
  identify: (frame: Blob, confidence = 0.4): Promise<IdentifyResult[]> => {
    const fd = new FormData();
    fd.append("frame", frame, "frame.jpg");
    return request<IdentifyResult[]>(
      `/api/attendance/identify?confidence=${confidence}`,
      { method: "POST", body: fd }
    );
  },

  mark: (
    sessionId: string,
    frame: Blob,
    confidence = 0.4
  ): Promise<MarkAttendanceResponse> => {
    const fd = new FormData();
    fd.append("frame", frame, "frame.jpg");
    return request<MarkAttendanceResponse>(
      `/api/attendance/mark/${sessionId}?confidence=${confidence}`,
      { method: "POST", body: fd }
    );
  },

  list: (params?: {
    session_id?: string;
    person_id?: string;
    date?: string;
    status?: string;
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return request<AttendanceRecord[]>(`/api/attendance${qs ? `?${qs}` : ""}`);
  },

  exportCsvUrl: (params?: { session_id?: string; date?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    return `${BASE_URL}/api/attendance/export/csv${qs ? `?${qs}` : ""}`;
  },
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  daily: (days = 30) =>
    request<DailyAttendanceStat[]>(`/api/reports/daily?days=${days}`),
  persons: (days = 30) =>
    request<PersonAttendanceStat[]>(`/api/reports/persons?days=${days}`),
  heatmap: (days = 14) =>
    request<HeatmapData>(`/api/reports/heatmap?days=${days}`),
};
