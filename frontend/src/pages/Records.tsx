import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Download, Search, ChevronLeft, ChevronRight,
  RefreshCw, Users, CalendarDays, ClipboardCheck, Filter,
} from "lucide-react";
import { attendanceApi, sessionsApi, type AttendanceRecord, type Session } from "@/services/api";
import { toast } from "sonner";

const PAGE_SIZE = 20;

const statusColor: Record<string, string> = {
  present: "bg-green-100 text-green-800 border-green-200",
  late:    "bg-yellow-100 text-yellow-800 border-yellow-200",
  absent:  "bg-red-100 text-red-800 border-red-200",
};

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-background">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold leading-none mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const Records = () => {
  const [records, setRecords]   = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search,     setSearch]     = useState("");
  const [sessionId,  setSessionId]  = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  // Pagination
  const [page, setPage] = useState(1);

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [recs, sess] = await Promise.all([
        attendanceApi.list({
          session_id: sessionId !== "all" ? sessionId : undefined,
          date:       dateFilter || undefined,
          status:     statusFilter !== "all" ? statusFilter : undefined,
        }),
        sessionsApi.list(),
      ]);
      setRecords(recs);
      setSessions(sess);
      setPage(1);
    } catch {
      toast.error("Failed to load records");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [sessionId, dateFilter, statusFilter]);

  // Derived departments list
  const departments = useMemo(() => {
    const set = new Set(records.map(r => r.department).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [records]);

  // Client-side search + dept filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter(r => {
      const matchSearch =
        !q ||
        r.person_name.toLowerCase().includes(q) ||
        r.session_label.toLowerCase().includes(q) ||
        (r.department ?? "").toLowerCase().includes(q);
      const matchDept =
        deptFilter === "all" || r.department === deptFilter;
      return matchSearch && matchDept;
    });
  }, [records, search, deptFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats
  const presentCount = filtered.filter(r => r.status === "present").length;
  const lateCount    = filtered.filter(r => r.status === "late").length;
  const uniquePeople = new Set(filtered.map(r => r.person_id)).size;

  const handleExport = () => {
    const url = attendanceApi.exportCsvUrl({
      session_id: sessionId !== "all" ? sessionId : undefined,
      date:       dateFilter || undefined,
    });
    window.open(url, "_blank");
  };

  const clearFilters = () => {
    setSearch("");
    setSessionId("all");
    setDateFilter("");
    setStatusFilter("all");
    setDeptFilter("all");
  };

  const hasActiveFilters =
    search || sessionId !== "all" || dateFilter ||
    statusFilter !== "all" || deptFilter !== "all";

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Attendance Records</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {loading ? "Loading…" : `${filtered.length} record${filtered.length !== 1 ? "s" : ""} found`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => load(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={ClipboardCheck} label="Total Records" value={filtered.length} />
            <StatCard icon={Users}          label="Unique People" value={uniquePeople} />
            <StatCard icon={CalendarDays}   label="Present"       value={presentCount}
              sub={filtered.length ? `${((presentCount/filtered.length)*100).toFixed(0)}%` : undefined} />
            <StatCard icon={Filter}         label="Late"          value={lateCount} />
          </div>
        )}

        {/* Filters */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, session, department…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>

              {/* Session filter */}
              <Select value={sessionId} onValueChange={(v) => { setSessionId(v); setPage(1); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sessions</SelectItem>
                  {sessions.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date filter */}
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                className="w-40"
                title="Filter by date"
              />

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>

              {/* Department filter */}
              {departments.length > 0 && (
                <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Clear filters */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground">
                  Clear filters
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Loading records…</p>
              </div>
            ) : paginated.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <ClipboardCheck className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm font-medium text-muted-foreground">No records found</p>
                {hasActiveFilters && (
                  <Button variant="link" size="sm" onClick={clearFilters}>
                    Clear filters to see all records
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Department</TableHead>
                        <TableHead className="font-semibold">Session</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Time</TableHead>
                        <TableHead className="font-semibold">Confidence</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((r) => {
                        const dt = new Date(r.marked_at);
                        return (
                          <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                            <TableCell className="font-medium">{r.person_name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {r.department ?? <span className="italic opacity-50">—</span>}
                            </TableCell>
                            <TableCell className="text-sm max-w-[160px] truncate" title={r.session_label}>
                              {r.session_label}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {r.status !== "absent"
                                ? dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : <span className="opacity-40">—</span>}
                            </TableCell>
                            <TableCell className="text-sm">
                              {r.confidence != null && r.confidence > 0 ? (
                                <span className={`font-mono text-xs px-2 py-0.5 rounded-md ${
                                  r.confidence >= 0.8
                                    ? "bg-green-50 text-green-700"
                                    : r.confidence >= 0.6
                                      ? "bg-yellow-50 text-yellow-700"
                                      : "bg-orange-50 text-orange-700"
                                }`}>
                                  {(r.confidence * 100).toFixed(1)}%
                                </span>
                              ) : <span className="opacity-40">—</span>}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs capitalize ${statusColor[r.status] ?? ""}`}
                              >
                                {r.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground px-2">
                        {page} / {totalPages}
                      </span>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Records;
