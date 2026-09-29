export * from "./types.js";
export class ApiError extends Error {
    status;
    data;
    constructor(status, message, data) {
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
    store = new Map();
    getItem(key) {
        return this.store.get(key) ?? null;
    }
    setItem(key, value) {
        this.store.set(key, value);
    }
    removeItem(key) {
        this.store.delete(key);
    }
}
export class SmartAttendClient {
    baseUrl;
    token = null;
    options;
    fetchFn;
    constructor(options = {}) {
        this.baseUrl = (options.baseUrl ?? "http://localhost:8000").replace(/\/+$/, "");
        this.options = options;
        this.fetchFn = options.fetch ?? (typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined);
        if (!this.fetchFn) {
            throw new Error("Fetch API is not available. Please pass a custom fetch implementation in SmartAttendClientOptions.");
        }
    }
    /**
     * Sets current active authentication token
     */
    async setToken(token) {
        this.token = token;
        if (this.options.storage) {
            if (token) {
                await this.options.storage.setItem("smartattend_auth_token", token);
            }
            else {
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
    async getToken() {
        if (this.token)
            return this.token;
        if (this.options.getAuthToken) {
            return (await this.options.getAuthToken()) ?? null;
        }
        if (this.options.storage) {
            return (await this.options.storage.getItem("smartattend_auth_token")) ?? null;
        }
        return null;
    }
    buildUrl(path, query) {
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
    async request(path, init = {}, query) {
        const url = this.buildUrl(path, query);
        const token = await this.getToken();
        const authHeaders = {};
        if (token) {
            authHeaders["Authorization"] = `Bearer ${token}`;
        }
        else if (this.options.apiKey) {
            authHeaders["X-API-Key"] = this.options.apiKey;
        }
        const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
        const headers = {
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
                msg = msg.map((m) => m.msg ?? JSON.stringify(m)).join(", ");
            }
            throw new ApiError(res.status, msg, err);
        }
        if (res.status === 204) {
            return undefined;
        }
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            return (await res.json());
        }
        return (await res.text());
    }
    // ── Auth Module ─────────────────────────────────────────────────────────────
    auth = {
        login: async (username, password) => {
            const token = await this.request("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({ username, password }),
            });
            await this.setToken(token.access_token);
            return token;
        },
        register: async (payload) => {
            return this.request("/api/auth/register", {
                method: "POST",
                body: JSON.stringify(payload),
            });
        },
        me: async () => {
            return this.request("/api/auth/me", { method: "GET" });
        },
        logout: async () => {
            await this.setToken(null);
        },
    };
    // ── Persons Module ──────────────────────────────────────────────────────────
    persons = {
        list: async (params) => {
            return this.request("/api/persons/", { method: "GET" }, params);
        },
        get: async (id) => {
            return this.request(`/api/persons/${id}`, { method: "GET" });
        },
        enroll: async (data) => {
            const formData = new FormData();
            formData.append("name", data.name);
            if (data.email)
                formData.append("email", data.email);
            if (data.department)
                formData.append("department", data.department);
            for (const photo of data.photos) {
                formData.append("photos", photo);
            }
            return this.request("/api/persons/enroll", {
                method: "POST",
                body: formData,
            });
        },
        delete: async (id) => {
            return this.request(`/api/persons/${id}`, { method: "DELETE" });
        },
    };
    // ── Sessions Module ─────────────────────────────────────────────────────────
    sessions = {
        list: async (params) => {
            return this.request("/api/sessions/", { method: "GET" }, params);
        },
        create: async (data) => {
            return this.request("/api/sessions/", {
                method: "POST",
                body: JSON.stringify(data),
            });
        },
        get: async (id) => {
            return this.request(`/api/sessions/${id}`, { method: "GET" });
        },
        end: async (id) => {
            return this.request(`/api/sessions/${id}/end`, { method: "PATCH" });
        },
    };
    // ── Attendance Module ───────────────────────────────────────────────────────
    attendance = {
        identify: async (photo) => {
            const formData = new FormData();
            formData.append("photo", photo);
            return this.request("/api/attendance/identify", {
                method: "POST",
                body: formData,
            });
        },
        mark: async (data) => {
            const formData = new FormData();
            formData.append("session_id", data.session_id);
            formData.append("photo", data.photo);
            return this.request("/api/attendance/mark", {
                method: "POST",
                body: formData,
            });
        },
        list: async (params) => {
            return this.request("/api/attendance/", { method: "GET" }, params);
        },
        exportCsv: async (sessionId) => {
            return this.request("/api/attendance/export", { method: "GET" }, sessionId ? { session_id: sessionId } : undefined);
        },
    };
    // ── Dashboard Module ────────────────────────────────────────────────────────
    dashboard = {
        getMetrics: async () => {
            return this.request("/api/dashboard/metrics", { method: "GET" });
        },
        getActivity: async (limit = 10) => {
            return this.request("/api/dashboard/activity", { method: "GET" }, { limit });
        },
    };
    // ── Reports Module ──────────────────────────────────────────────────────────
    reports = {
        getDailyStats: async (days = 7) => {
            return this.request("/api/reports/daily", { method: "GET" }, { days });
        },
        getRates: async (params) => {
            return this.request("/api/reports/rates", { method: "GET" }, params);
        },
        getHeatmap: async (days = 30) => {
            return this.request("/api/reports/heatmap", { method: "GET" }, { days });
        },
    };
    // ── Diagnostics ─────────────────────────────────────────────────────────────
    diagnostics = {
        getSystemDiagnostics: async () => {
            return this.request("/health", { method: "GET" });
        },
    };
}
export function createSmartAttendClient(options) {
    return new SmartAttendClient(options);
}
//# sourceMappingURL=index.js.map