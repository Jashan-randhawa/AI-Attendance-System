import React, { useState, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  useDailyReports, usePersonReports, useHeatmapReport
} from "@/hooks/useAttendanceQueries";
import { AlertTriangle, Calendar, TrendingUp, Users } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const Reports = () => {
  const [days, setDays] = useState<number>(30);
  const [personSearch, setPersonSearch] = useState("");

  const { data: dailyData, isLoading: loadingDaily } = useDailyReports(days);
  const { data: personStats, isLoading: loadingPersons } = usePersonReports(days);
  const { data: heatmapData, isLoading: loadingHeatmap } = useHeatmapReport(14);

  const loading = loadingDaily || loadingPersons;

  const reportsContainerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(".gsap-reports-header", {
        y: -12,
        opacity: 0,
        duration: 0.4,
        ease: "power2.out",
      });

      ScrollTrigger.batch(".gsap-scroll-section", {
        start: "top 88%",
        once: true,
        onEnter: (batch) => {
          gsap.from(batch, {
            y: 20,
            opacity: 0,
            duration: 0.45,
            stagger: 0.1,
            ease: "power2.out",
            overwrite: true,
          });
        },
      });
    },
    { scope: reportsContainerRef, dependencies: [days, loading] }
  );

  const chartData = (dailyData || []).map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    rate: Math.round(d.attendance_rate),
    present: d.total_present,
    late: d.total_late,
  }));

  const filteredPersons = (personStats || []).filter(
    (p) =>
      p.person_name.toLowerCase().includes(personSearch.toLowerCase()) ||
      p.department?.toLowerCase().includes(personSearch.toLowerCase())
  );

  const defaulters = (personStats || []).filter((p) => p.attendance_rate < 75);

  return (
    <AppLayout>
      <div ref={reportsContainerRef} className="space-y-8 max-w-7xl mx-auto">
        <PageHeader
          className="gsap-reports-header"
          badge="Analytics & Insights"
          title="Attendance Analytics & Reports"
          description="Long-term trends, departmental analysis, and low-attendance alerts."
          actions={
            <div className="flex items-center gap-1.5 bg-secondary/70 p-1 rounded-xl border border-border/80">
              {[7, 30, 90].map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={days === d ? "default" : "ghost"}
                  className={`h-7 px-3 text-xs ${days === d ? "gradient-primary text-white font-semibold" : ""}`}
                  onClick={() => setDays(d)}
                >
                  Last {d} Days
                </Button>
              ))}
            </div>
          }
        />

        {defaulters.length > 0 && (
          <div className="gsap-scroll-section p-4 rounded-xl border border-destructive/30 bg-destructive/10 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-destructive">
                Low Attendance Alert: {defaulters.length} subject(s) below 75% threshold
              </p>
              <p className="text-xs text-destructive/80 mt-0.5">
                Review subjects requiring attendance intervention or academic counseling.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="gsap-scroll-section border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Daily Attendance Rate (%)
              </CardTitle>
              <CardDescription>Percentage of enrolled subjects present per session day</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-64">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading chart...</div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                      <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="rate"
                        name="Attendance %"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "hsl(var(--primary))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data for selected period</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="gsap-scroll-section border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" /> Present vs Late Breakdown
              </CardTitle>
              <CardDescription>Headcount comparison across recorded days</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-64">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading breakdown...</div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="present" name="Present" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="late" name="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data for selected period</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="gsap-scroll-section border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">14-Day Attendance Heatmap</CardTitle>
            <CardDescription>Daily participation intensity per individual</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHeatmap ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading heatmap...</p>
            ) : heatmapData && heatmapData.matrix && heatmapData.matrix.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left font-medium py-2 px-3 text-muted-foreground">Person</th>
                      {heatmapData.dates.map((d) => (
                        <th key={d} className="text-center font-medium py-2 px-1 text-muted-foreground w-8">
                          {new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "narrow" })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapData.matrix.slice(0, 15).map((row) => (
                      <tr key={row.person_id} className="border-b border-border/40 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium truncate max-w-[150px]">{row.name}</td>
                        {heatmapData.dates.map((d) => {
                          const status = row.days[d];
                          const bg =
                            status === "present"
                              ? "bg-emerald-500 text-white"
                              : status === "late"
                              ? "bg-amber-500 text-white"
                              : status === "absent"
                              ? "bg-rose-500/40 text-rose-900"
                              : "bg-muted/60";
                          return (
                            <td key={d} className="p-1 text-center">
                              <span
                                title={`${row.name} - ${d}: ${status || "none"}`}
                                className={`inline-block w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${bg}`}
                              >
                                {status === "present" ? "P" : status === "late" ? "L" : status === "absent" ? "A" : "-"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No heatmap data available.</p>
            )}
          </CardContent>
        </Card>

        <Card className="gsap-scroll-section border-border/60 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Individual Subject Attendance Rates
              </CardTitle>
              <CardDescription>Full roster breakdown with total sessions and rates</CardDescription>
            </div>
            <div className="w-full sm:w-64">
              <Input
                placeholder="Search subject or dept..."
                value={personSearch}
                onChange={(e) => setPersonSearch(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loadingPersons ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading subject rates...</p>
            ) : filteredPersons.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Subject Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Sessions Attended</TableHead>
                      <TableHead className="text-right">Total Sessions</TableHead>
                      <TableHead className="text-right">Attendance Rate</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPersons.map((p) => {
                      const isDefaulter = p.attendance_rate < 75;
                      return (
                        <TableRow key={p.person_id}>
                          <TableCell className="font-semibold text-sm">{p.person_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.department || "General"}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{p.attended_sessions}</TableCell>
                          <TableCell className="text-right text-xs font-mono">{p.total_sessions}</TableCell>
                          <TableCell className="text-right text-xs font-bold">
                            <span className={isDefaulter ? "text-rose-600" : "text-emerald-600"}>
                              {Math.round(p.attendance_rate)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {isDefaulter ? (
                              <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 text-[10px]">
                                Defaulter
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                                Good Standing
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No subjects found matching query.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Reports;