import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  reportsApi,
  type DailyAttendanceStat, type PersonAttendanceStat,
} from "@/services/api";
import { toast } from "sonner";

const Reports = () => {
  const [dailyData, setDailyData] = useState<DailyAttendanceStat[]>([]);
  const [personStats, setPersonStats] = useState<PersonAttendanceStat[]>([]);
  const [personSearch, setPersonSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([reportsApi.daily(30), reportsApi.persons(30)])
      .then(([daily, persons]) => {
        setDailyData(daily);
        setPersonStats(persons);
      })
      .catch(() => toast.error("Failed to load reports"))
      .finally(() => setLoading(false));
  }, []);

  const chartData = dailyData.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    rate: Math.round(d.attendance_rate),
  }));

  // Group by... just use the person stats as dept data approximation
  const deptMap: Record<string, { present: number; absent: number }> = {};
  personStats.forEach((p) => {
    const dept = p.department ?? "Other";
    if (!deptMap[dept]) deptMap[dept] = { present: 0, absent: 0 };
    deptMap[dept].present += p.present_count;
    deptMap[dept].absent += p.total_sessions - p.present_count;
  });
  const deptData = Object.entries(deptMap).map(([dept, v]) => ({ dept, ...v }));

  const defaulters = personStats.filter((p) => p.is_defaulter);

  const searchedPerson = personSearch.trim()
    ? personStats.filter((p) => p.name.toLowerCase().includes(personSearch.toLowerCase()))
    : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Attendance trends and insights</p>
        </div>

        {/* Person Search */}
        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle className="text-base">🔍 Search Person Record</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Type a name to search…"
              value={personSearch}
              onChange={(e) => setPersonSearch(e.target.value)}
              className="max-w-sm"
            />
            {personSearch.trim() && searchedPerson.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">No person found matching "{personSearch}"</p>
            )}
            {searchedPerson.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead><TableHead>Department</TableHead>
                    <TableHead>Sessions</TableHead><TableHead>Present</TableHead>
                    <TableHead>Rate</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchedPerson.map((p) => (
                    <TableRow key={p.person_id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.department ?? "—"}</TableCell>
                      <TableCell>{p.total_sessions}</TableCell>
                      <TableCell>{p.present_count}</TableCell>
                      <TableCell>{p.attendance_rate.toFixed(1)}%</TableCell>
                      <TableCell>
                        <Badge className={p.is_defaulter
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-success text-success-foreground"}>
                          {p.is_defaulter ? "At Risk" : "Good"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Loading reports…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-none shadow-sm">
                <CardHeader><CardTitle className="text-base">Daily Attendance Rate (%)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="rate" stroke="hsl(187 94% 43%)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader><CardTitle className="text-base">Department Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={deptData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                      <XAxis dataKey="dept" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="present" fill="hsl(187 94% 43%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="absent" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle className="text-base">⚠️ Defaulters (&lt; 75% Attendance)</CardTitle></CardHeader>
              <CardContent>
                {defaulters.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No defaulters — great attendance!</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead><TableHead>Department</TableHead>
                        <TableHead>Attendance Rate</TableHead><TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {defaulters.map((d) => (
                        <TableRow key={d.person_id}>
                          <TableCell className="font-medium">{d.name}</TableCell>
                          <TableCell>{d.department ?? "—"}</TableCell>
                          <TableCell>{d.attendance_rate.toFixed(1)}%</TableCell>
                          <TableCell>
                            <Badge className="bg-destructive text-destructive-foreground">At Risk</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Reports;
