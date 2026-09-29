import type { ActivityItem, AttendanceRecord, AuthToken, DailyAttendanceStat, DashboardMetrics, HeatmapItem, IdentifyResult, MarkAttendanceResponse, Person, PersonAttendanceRate, Session, SmartAttendClientOptions, SystemDiagnostics, User } from "./types.js";
export * from "./types.js";
export declare class ApiError extends Error {
    status: number;
    data: any;
    constructor(status: number, message: string, data?: any);
}
/**
 * In-memory storage adapter default
 */
export declare class MemoryStorageAdapter {
    private store;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
export declare class SmartAttendClient {
    private baseUrl;
    private token;
    private options;
    private fetchFn;
    constructor(options?: SmartAttendClientOptions);
    /**
     * Sets current active authentication token
     */
    setToken(token: string | null): Promise<void>;
    /**
     * Retrieves active authentication token
     */
    getToken(): Promise<string | null>;
    private buildUrl;
    request<T>(path: string, init?: RequestInit, query?: Record<string, string | number | boolean | undefined | null>): Promise<T>;
    readonly auth: {
        login: (username: string, password: string) => Promise<AuthToken>;
        register: (payload: {
            username: string;
            password: string;
            email?: string | null;
            role?: "operator" | "admin";
        }) => Promise<User>;
        me: () => Promise<User>;
        logout: () => Promise<void>;
    };
    readonly persons: {
        list: (params?: {
            search?: string;
            department?: string;
            active_only?: boolean;
        }) => Promise<Person[]>;
        get: (id: string) => Promise<Person>;
        enroll: (data: {
            name: string;
            email?: string;
            department?: string;
            photos: (Blob | File | any)[];
        }) => Promise<Person>;
        delete: (id: string) => Promise<void>;
    };
    readonly sessions: {
        list: (params?: {
            active_only?: boolean;
        }) => Promise<Session[]>;
        create: (data: {
            label: string;
            department?: string;
        }) => Promise<Session>;
        get: (id: string) => Promise<Session>;
        end: (id: string) => Promise<Session>;
    };
    readonly attendance: {
        identify: (photo: Blob | File | any) => Promise<IdentifyResult[]>;
        mark: (data: {
            session_id: string;
            photo: Blob | File | any;
        }) => Promise<MarkAttendanceResponse>;
        list: (params?: {
            session_id?: string;
            person_id?: string;
            date?: string;
        }) => Promise<AttendanceRecord[]>;
        exportCsv: (sessionId?: string) => Promise<string>;
    };
    readonly dashboard: {
        getMetrics: () => Promise<DashboardMetrics>;
        getActivity: (limit?: number) => Promise<ActivityItem[]>;
    };
    readonly reports: {
        getDailyStats: (days?: number) => Promise<DailyAttendanceStat[]>;
        getRates: (params?: {
            department?: string;
        }) => Promise<PersonAttendanceRate[]>;
        getHeatmap: (days?: number) => Promise<HeatmapItem[]>;
    };
    readonly diagnostics: {
        getSystemDiagnostics: () => Promise<SystemDiagnostics>;
    };
}
export declare function createSmartAttendClient(options?: SmartAttendClientOptions): SmartAttendClient;
//# sourceMappingURL=index.d.ts.map