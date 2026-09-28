import type {
  ActivityItem,
  AttendanceRecord,
  AuthToken,
  DailyAttendanceStat,
  DashboardMetrics,
  HeatmapItem,
  IdentifyResult,
  MarkAttendanceResponse,
  Person,
  PersonAttendanceRate,
  Session,
  SmartAttendClientOptions,
  SystemDiagnostics,
  User,
} from "./types.js";

export * from "./types.js";

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * In-memory storage adapter default
 */
export class MemoryStorageAdapter {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

export class SmartAttendClient {
  private baseUrl: string;
  private token: string | null = null;
  private options: SmartAttendClientOptions;
  private fetchFn: typeof fetch;

  constructor(options: SmartAttendClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://localhost:8000").replace(/\/+$/, "");
    this.options = options;
    this.fetchFn = options.fetch ?? (typeof fetch !== "undefined" ? fetch.bind(globalThis) : (undefined as any));

    if (!this.fetchFn) {
      throw new Error(
        "Fetch API is not available. Please pass a custom fetch implementation in SmartAttendClientOptions."
      );
    }
  }

  /**
   * Sets current active authentication token
   */
  async setToken(token: string | null): Promise<void> {
    this.token = token;
    if (this.options.storage) {
      if (token) {
        await this.options.storage.setItem("smartattend_auth_token", token);
      } else {
        await this.options.storage.removeItem("smartattend_auth_token");
      }
    }
    if (this.options.setAuthToken) {
      await this.options.setAuthToken(token);
    }
  }

  /**
   * Retrieves active authentication token
   */
  async getToken(): Promise<string | null> {
    if (this.token) return this.token;
    if (this.options.getAuthToken) {
      return (await this.options.getAuthToken()) ?? null;
    }
    if (this.options.storage) {
      return (await this.options.storage.getItem("smartattend_auth_token")) ?? null;
    }
    return null;
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined | null>): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    let url = `${this.baseUrl}${cleanPath}`;
    if (query) {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== "") {
          sp.append(k, String(v));
        }
      }
      const qs = sp.toString();
      if (qs) {
        url += `?${qs}`;
      }
    }
    return url;
  }

  async request<T>(
    path: string,
    init: RequestInit = {},
    query?: Record<string, string | number | boolean | undefined | null>
  ): Promise<T> {
    const url = this.buildUrl(path, query);
    const token = await this.getToken();

    const authHeaders: Record<string, string> = {};
    if (token) {
      authHeaders["Authorization"] = `Bearer ${token}`;
    } else if (this.options.apiKey) {
      authHeaders["X-API-Key"] = this.options.apiKey;
    }

    const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
    const headers: Record<string, string> = {
      ...this.options.defaultHeaders,
      ...authHeaders,
    };
    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }
    if (init.headers) {
      Object.assign(headers, init.headers);
    }

    const res = await this.fetchFn(url, {
      ...init,
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      let msg = err.detail ?? `Request failed with status ${res.status}`;
      if (Array.isArray(msg)) {
        msg = msg.map((m: any) => m.msg ?? JSON.stringify(m)).join(", ");
      }
      throw new ApiError(res.status, msg, err);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await res.json()) as T;
    }
    return (await res.text()) as unknown as T;
  }

  // ── Auth Module ─────────────────────────────────────────────────────────────
  readonly auth = {
    login: async (username: string, password: string): Promise<AuthToken> => {
      const token = await this.request<AuthToken>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      await this.setToken(token.access_token);
      return token;
    },

    register: async (payload: {
      username: string;
      password: string;
      email?: string | null;
      role?: "operator" | "admin";
    }): Promise<User> => {
      return this.request<User>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    me: async (): Promise<User> => {
      return this.request<User>("/api/auth/me", { method: "GET" });
    },

    logout: async (): Promise<void> => {
      await this.setToken(null);
    },
  };

  // ── Persons Module ──────────────────────────────────────────────────────────
  readonly persons = {
    list: async (params?: {
      search?: string;
      department?: string;
      active_only?: boolean;
    }): Promise<Person[]> => {
      return this.request<Person[]>("/api/persons/", { method: "GET" }, params);
    },

    get: async (id: string): Promise<Person> => {
      return this.request<Person>(`/api/persons/${id}`, { method: "GET" });
    },

    enroll: async (data: {
      name: string;
      email?: string;
      department?: string;
      photos: (Blob | File | any)[];
    }): Promise<Person> => {
      const formData = new FormData();
      formData.append("name", data.name);
      if (data.email) formData.append("email", data.email);
      if (data.department) formData.append("department", data.department);
      for (const photo of data.photos) {
        formData.append("photos", photo);
      }

      return this.request<Person>("/api/persons/enroll", {
        method: "POST",
        body: formData,
      });
    },

    delete: async (id: string): Promise<void> => {
      return this.request<void>(`/api/persons/${id}`, { method: "DELETE" });
    },
  };

  // ── Sessions Module ─────────────────────────────────────────────────────────
  readonly sessions = {
    list: async (params?: { active_only?: boolean }): Promise<Session[]> => {
      return this.request<Session[]>("/api/sessions/", { method: "GET" }, params);
    },

    create: async (data: { label: string; department?: string }): Promise<Session> => {
      return this.request<Session>("/api/sessions/", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    get: async (id: string): Promise<Session> => {
      return this.request<Session>(`/api/sessions/${id}`, { method: "GET" });
    },

    end: async (id: string): Promise<Session> => {
      return this.request<Session>(`/api/sessions/${id}/end`, { method: "PATCH" });
    },
  };

  // ── Attendance Module ───────────────────────────────────────────────────────
  readonly attendance = {
    identify: async (photo: Blob | File | any): Promise<IdentifyResult[]> => {
      const formData = new FormData();
      formData.append("photo", photo);
      return this.request<IdentifyResult[]>("/api/attendance/identify", {
        method: "POST",
        body: formData,
      });
    },

    mark: async (data: {
      session_id: string;
      photo: Blob | File | any;
    }): Promise<MarkAttendanceResponse> => {
      const formData = new FormData();
      formData.append("session_id", data.session_id);
      formData.append("photo", data.photo);
      return this.request<MarkAttendanceResponse>("/api/attendance/mark", {
        method: "POST",
        body: formData,
      });
    },

    list: async (params?: {
      session_id?: string;
      person_id?: string;
      date?: string;
    }): Promise<AttendanceRecord[]> => {
      return this.request<AttendanceRecord[]>("/api/attendance/", { method: "GET" }, params);
    },

    exportCsv: async (sessionId?: string): Promise<string> => {
      return this.request<string>(
        "/api/attendance/export",
        { method: "GET" },
        sessionId ? { session_id: sessionId } : undefined
      );
    },
  };

  // ── Dashboard Module ────────────────────────────────────────────────────────
  readonly dashboard = {
    getMetrics: async (): Promise<DashboardMetrics> => {
      return this.request<DashboardMetrics>("/api/dashboard/metrics", { method: "GET" });
    },

    getActivity: async (limit: number = 10): Promise<ActivityItem[]> => {
      return this.request<ActivityItem[]>("/api/dashboard/activity", { method: "GET" }, { limit });
    },
  };

  // ── Reports Module ──────────────────────────────────────────────────────────
  readonly reports = {
    getDailyStats: async (days: number = 7): Promise<DailyAttendanceStat[]> => {
      return this.request<DailyAttendanceStat[]>("/api/reports/daily", { method: "GET" }, { days });
    },

    getRates: async (params?: { department?: string }): Promise<PersonAttendanceRate[]> => {
      return this.request<PersonAttendanceRate[]>("/api/reports/rates", { method: "GET" }, params);
    },

    getHeatmap: async (days: number = 30): Promise<HeatmapItem[]> => {
      return this.request<HeatmapItem[]>("/api/reports/heatmap", { method: "GET" }, { days });
    },
  };

  // ── Diagnostics ─────────────────────────────────────────────────────────────
  readonly diagnostics = {
    getSystemDiagnostics: async (): Promise<SystemDiagnostics> => {
      return this.request<SystemDiagnostics>("/health", { method: "GET" });
    },
  };
}

export function createSmartAttendClient(options?: SmartAttendClientOptions): SmartAttendClient {
  return new SmartAttendClient(options);
}
