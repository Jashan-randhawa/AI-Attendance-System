import React, { useRef } from "react";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import MetricCard from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, CalendarCheck, UserCheck, TrendingUp, Camera, Play, ArrowRight, Clock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useDashboardMetrics, useDashboardActivity, useSessions, useDailyReports } from "@/hooks/useAttendanceQueries";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const statusColor: Record<string, string> = {
  present: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  late: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  absent: "bg-rose-500/15 text-rose-600 border-rose-500/30",
};

const Dashboard: React.FC = () => {
  const { data: metrics, isLoading: loadingMetrics } = useDashboardMetrics();
  const { data: activity, isLoading: loadingActivity } = useDashboardActivity();
  const { data: activeSessions } = useSessions(true);
  const { data: dailyReports } = useDailyReports(7);

  const dashboardRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.from(".gsap-header", {
        y: -10,
        opacity: 0,
        duration: 0.35,
      })
        .from(
          ".gsap-kpi-card",
          {
            y: 16,
            opacity: 0,
            duration: 0.4,
            stagger: 0.07,
          },
          "-=0.15"
        )
        .from(
          ".gsap-dashboard-card",
          {
            y: 20,
            opacity: 0,
            duration: 0.45,
            stagger: 0.1,
          },
          "-=0.2"
        );
    },
    { scope: dashboardRef }
  );

  const weeklyData = (dailyReports || []).map((d) => ({
    day: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }),
    present: d.total_present,
    sessions: d.total_sessions,
  }));

  const currentActiveSession = activeSessions && activeSessions.length > 0 ? activeSessions[0] : null;

  return (
    <AppLayout>
      <div ref={dashboardRef} className="space-y-8 max-w-7xl mx-auto">
        <div className="gsap-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Live biometric surveillance & attendance operational status
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link to="/reports">View Analytics</Link>
            </Button>
            <Button size="sm" className="gradient-primary text-primary-foreground shadow-sm" asChild>
              <Link to="/sessions">
                <Play className="w-3.5 h-3.5 mr-1.5" /> Start Session
              </Link>
            </Button>
          </div>
        </div>

        {currentActiveSession && (
          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-enter-subtle">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
              <div>
                <p className="font-semibold text-sm">
                  Active Session: <span className="text-primary">{currentActiveSession.session_name}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentActiveSession.expected_department || "All Departments"} • Started{" "}
                  {new Date(currentActiveSession.start_time).toLocaleTimeString()}
                </p>
              </div>
            </div>

            <Button size="sm" className="gradient-primary text-primary-foreground" asChild>
              <Link to={`/live?session=${currentActiveSession.id}`}>
                <Camera className="w-3.5 h-3.5 mr-1.5" /> Open Live Camera
              </Link>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="gsap-kpi-card">
            <MetricCard
              title="Total Registered Subjects"
              value={loadingMetrics ? "..." : (metrics?.total_persons ?? 0)}
              change={`${metrics?.total_departments ?? 0} active departments`}
              trend="neutral"
              icon={Users}
            />
          </div>
          <div className="gsap-kpi-card">
            <MetricCard
              title="Today's Total Scans"
              value={loadingMetrics ? "..." : (metrics?.today_attendance ?? 0)}
              change="Real-time check-ins"
              trend="up"
              icon={CalendarCheck}
            />
          </div>
          <div className="gsap-kpi-card">
            <MetricCard
              title="Active Sessions"
              value={loadingMetrics ? "..." : (metrics?.active_sessions ?? 0)}
              change={`${metrics?.total_sessions ?? 0} total lifetime`}
              trend="neutral"
              icon={UserCheck}
            />
          </div>
          <div className="gsap-kpi-card">
            <MetricCard
              title="30-Day Attendance Rate"
              value={loadingMetrics ? "..." : `${Math.round(metrics?.attendance_rate ?? 0)}%`}
              change="Organization average"
              trend="up"
              icon={TrendingUp}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="gsap-dashboard-card lg:col-span-2 border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">Weekly Attendance Trend</CardTitle>
                <CardDescription>Daily present count over the past 7 days</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-64">
                {weeklyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} barGap={6}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="present" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No attendance records for the last 7 days
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="gsap-dashboard-card border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
                <CardDescription>Latest face scans recorded</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" asChild>
                <Link to="/records">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loadingActivity ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Loading activity...</p>
              ) : activity?.recent_scans && activity.recent_scans.length > 0 ? (
                <div className="space-y-3 mt-1">
                  {activity.recent_scans.slice(0, 5).map((scan) => (
                    <div key={scan.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                      <div>
                        <p className="font-semibold">{scan.person_name}</p>
                        <p className="text-muted-foreground text-[10px] flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(scan.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] uppercase font-bold ${statusColor[scan.status] || ""}`}>
                        {scan.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No activity scans recorded yet today.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;