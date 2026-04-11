import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import MetricCard from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CalendarCheck, UserCheck, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  dashboardApi, reportsApi,
  type DashboardMetrics, type ActivityItem, type DailyAttendanceStat,
} from "@/services/api";
import { toast } from "sonner";

const statusColor: Record<string, string> = {
  present: "bg-success text-success-foreground",
  late: "bg-warning text-warning-foreground",
  absent: "bg-destructive text-destructive-foreground",
};

const Dashboard = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ day: string; present: number; sessions: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [m, act, daily] = await Promise.all([
          dashboardApi.getMetrics(),
          dashboardApi.getActivity(),
          reportsApi.daily(7),
        ]);
        setMetrics(m);
        setActivity(act);
        setWeeklyData(
          daily.map((d: DailyAttendanceStat) => ({
            day: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }),
            present:  d.total_present,
            sessions: d.total_sessions,
          }))
        );
      } catch {
        toast.error("Failed to load dashboard. Is the backend running?");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of today's attendance</p>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm animate-pulse">Loading metrics…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Total Enrolled" value={metrics?.total_enrolled ?? 0} icon={Users} />
              <MetricCard title="Sessions Today" value={metrics?.sessions_today ?? 0} icon={CalendarCheck} />
              <MetricCard title="Present Today" value={metrics?.present_today ?? 0} icon={UserCheck}
                trend={metrics ? `${metrics.attendance_rate.toFixed(1)}%` : undefined}
                trendUp={(metrics?.attendance_rate ?? 0) >= 75} />
              <MetricCard title="Attendance Rate" value={`${metrics?.attendance_rate?.toFixed(1) ?? 0}%`} icon={TrendingUp} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border-none shadow-sm">
                <CardHeader><CardTitle className="text-base">Weekly Attendance</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value, name) => [value, name === "present" ? "Attendees" : "Sessions"]} />
                      <Bar dataKey="present"  name="present"  fill="hsl(187 94% 43%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="sessions" name="sessions" fill="hsl(214 32% 70%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {activity.slice(0, 8).map((r) => (
                    <div key={r.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{r.person_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.marked_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <Badge className={statusColor[r.status] ?? ""}>{r.status}</Badge>
                    </div>
                  ))}
                  {activity.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No activity yet today</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
