import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  dashboardApi,
  personsApi,
  sessionsApi,
  attendanceApi,
  reportsApi,
  authApi,
  systemApi,
  type UserCreatePayload,
} from "@/services/api";

// ── Query Keys ──────────────────────────────────────────────────────────────
export const queryKeys = {
  dashboardMetrics: ["dashboard", "metrics"] as const,
  dashboardActivity: ["dashboard", "activity"] as const,
  sessions: (active?: boolean) => ["sessions", { active }] as const,
  session: (id: string) => ["sessions", id] as const,
  persons: ["persons"] as const,
  person: (id: string) => ["persons", id] as const,
  attendance: (params?: Record<string, any>) => ["attendance", params] as const,
  reportsDaily: (days: number) => ["reports", "daily", days] as const,
  reportsPersons: (days: number) => ["reports", "persons", days] as const,
  reportsHeatmap: (days: number) => ["reports", "heatmap", days] as const,
  users: ["users"] as const,
  systemConfig: ["system", "config"] as const,
  systemEncodings: ["system", "encodings"] as const,
};

// ── Dashboard Hooks ──────────────────────────────────────────────────────────
export const useDashboardMetrics = () =>
  useQuery({
    queryKey: queryKeys.dashboardMetrics,
    queryFn: () => dashboardApi.getMetrics(),
    refetchInterval: 15000,
  });

export const useDashboardActivity = () =>
  useQuery({
    queryKey: queryKeys.dashboardActivity,
    queryFn: () => dashboardApi.getRecentActivity(),
    refetchInterval: 10000,
  });

// ── Sessions Hooks ───────────────────────────────────────────────────────────
export const useSessions = (active?: boolean) =>
  useQuery({
    queryKey: queryKeys.sessions(active),
    queryFn: () => sessionsApi.listSessions(active),
    refetchInterval: active ? 10000 : false,
  });

export const useSession = (id: string) =>
  useQuery({
    queryKey: queryKeys.session(id),
    queryFn: () => sessionsApi.getSession(id),
    enabled: Boolean(id),
  });

export const useCreateSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      session_name: string;
      session_type: string;
      start_time: string;
      end_time?: string;
      expected_department?: string;
    }) => sessionsApi.createSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics });
    },
  });
};

export const useEndSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => sessionsApi.endSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics });
    },
  });
};

// ── Persons Hooks ───────────────────────────────────────────────────────────
export const usePersons = () =>
  useQuery({
    queryKey: queryKeys.persons,
    queryFn: () => personsApi.listPersons(),
  });

export const usePerson = (id: string) =>
  useQuery({
    queryKey: queryKeys.person(id),
    queryFn: () => personsApi.getPerson(id),
    enabled: Boolean(id),
  });

export const useDeletePerson = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personId: string) => personsApi.deletePerson(personId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.persons });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics });
    },
  });
};

// ── Attendance Hooks ────────────────────────────────────────────────────────
export const useAttendance = (params?: {
  session_id?: string;
  person_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  skip?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: queryKeys.attendance(params),
    queryFn: () => attendanceApi.getRecords(params),
  });

export const useAttendanceRecords = useAttendance;

// ── Reports Hooks ───────────────────────────────────────────────────────────
export const useDailyReports = (days: number = 30) =>
  useQuery({
    queryKey: queryKeys.reportsDaily(days),
    queryFn: () => reportsApi.getDaily(days),
  });

export const usePersonReports = (days: number = 30) =>
  useQuery({
    queryKey: queryKeys.reportsPersons(days),
    queryFn: () => reportsApi.getPersons(days),
  });

export const useHeatmapReport = (days: number = 14) =>
  useQuery({
    queryKey: queryKeys.reportsHeatmap(days),
    queryFn: () => reportsApi.getHeatmap(days),
  });

// ── Admin User Management Hooks ─────────────────────────────────────────────
export const useUsers = () =>
  useQuery({
    queryKey: queryKeys.users,
    queryFn: () => authApi.listUsers(),
  });

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserCreatePayload) => authApi.registerUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
};

export const useRegisterUser = useCreateUser;

// ── System Diagnostics Hooks ─────────────────────────────────────────────────
export const useSystemConfig = () =>
  useQuery({
    queryKey: queryKeys.systemConfig,
    queryFn: () => systemApi.getDebugConfig(),
  });

export const useMissingEncodings = () =>
  useQuery({
    queryKey: queryKeys.systemEncodings,
    queryFn: () => systemApi.getDebugEncodings(),
  });
