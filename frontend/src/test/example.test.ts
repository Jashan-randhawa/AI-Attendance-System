import { describe, it, expect } from "vitest";
import { ApiError } from "@/services/api";
import { queryKeys } from "@/hooks/useAttendanceQueries";

describe("Frontend Core Services & Architecture", () => {
  it("creates ApiError instances with status code and payload", () => {
    const error = new ApiError(401, "Invalid credentials", { detail: "Bad token" });
    expect(error.name).toBe("ApiError");
    expect(error.status).toBe(401);
    expect(error.message).toBe("Invalid credentials");
    expect(error.data).toEqual({ detail: "Bad token" });
  });

  it("constructs correct TanStack Query keys", () => {
    expect(queryKeys.dashboardMetrics).toEqual(["dashboard", "metrics"]);
    expect(queryKeys.dashboardActivity).toEqual(["dashboard", "activity"]);
    expect(queryKeys.sessions(true)).toEqual(["sessions", { active: true }]);
    expect(queryKeys.session("sess-123")).toEqual(["sessions", "sess-123"]);
    expect(queryKeys.reportsDaily(30)).toEqual(["reports", "daily", 30]);
    expect(queryKeys.reportsHeatmap(14)).toEqual(["reports", "heatmap", 14]);
    expect(queryKeys.systemConfig).toEqual(["system", "config"]);
    expect(queryKeys.systemEncodings).toEqual(["system", "encodings"]);
  });
});
