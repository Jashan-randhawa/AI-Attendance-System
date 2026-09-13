import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
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
  SlidersHorizontal, ChevronDown, ChevronUp,
} from "lucide-react";
import { attendanceApi, sessionsApi, type AttendanceRecord, type Session } from "@/services/api";
import { useAuth } from "@/auth/AuthContext";
import { toast } from "sonner";

const PAGE_SIZE = 20;

const statusColor: Record<string, string> = {
  present: "bg-green-100 text-green-800 border-green-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/50",
  late:    "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/50",
  absent:  "bg-red-100 text-red-800 border-red-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700/50",
};

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-border bg-background">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg sm:text-xl font-semibold leading-none mt-0.5">{value}</p>
        {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const Records = () => {
  const [searchParams] = useSearchParams();
  const initialSessionId = searchParams.get("sessionId") || "all";

  const { role } = useAuth();
  const [records, setRecords]   = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search,     setSearch]     = useState("");
  const [sessionId,  setSessionId]  = useState<string>(initialSessionId);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  // Pagination
  const [page, setPage] = useState(1);

  const toggleExpand = (id: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const activeFilterCount = [
    sessionId !== "all",
    Boolean(dateFilter),
    statusFilter !== "all",
    deptFilter !== "all",
  ].filter(Boolean).length;

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
      <div className="space-y-4 sm:space-y-6 w-full">
        <PageHeader
          badge="Audit Logs"
          title="Attendance Records"
          description={loading ? "Loading records archive…" : `${filtered.length} record${filtered.length !== 1 ? "s" : ""} found across active filters.`}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => load(true)}
                disabled={refreshing}
                className="btn-tactile shadow-xs min-h-[38px]"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              {role === "admin" && (
                <Button variant="outline" size="sm" onClick={handleExport} className="btn-tactile shadow-xs min-h-[38px]">
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
              )}
            </div>
          }
        />

        {/* Stat cards */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            <StatCard icon={ClipboardCheck} label="Total Records" value={filtered.length} />
            <StatCard icon={Users}          label="Unique People" value={uniquePeople} />
            <StatCard icon={CalendarDays}   label="Present"       value={presentCount}
              sub={filtered.length ? `${((presentCount/filtered.length)*100).toFixed(0)}%` : undefined} />
            <StatCard icon={Filter}         label="Late"          value={lateCount} />
          </div>
        )}

        {/* Filters */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3 px-3.5 sm:px-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name, session, department…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="pl-9 min-h-[42px]"
                  />
                </div>

                {/* Mobile Filters Toggle Button (< md) */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMobileFilters((v) => !v)}
                  className="md:hidden shrink-0 min-h-[42px] px-3 gap-1.5"
                >
                  <SlidersHorizontal className="w-4 h-4 text-primary" />
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 rounded-full h-4">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </div>

              {/* Filter controls row (always visible on desktop, toggleable on mobile) */}
              <div className={`flex-wrap gap-2.5 items-center ${showMobileFilters ? "flex" : "hidden md:flex"}`}>
                {/* Session filter */}
                <Select value={sessionId} onValueChange={(v) => { setSessionId(v); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-44 min-h-[40px]">
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
                  className="w-full sm:w-40 min-h-[40px]"
                  title="Filter by date"
                />

                {/* Status filter */}
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-36 min-h-[40px]">
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
                    <SelectTrigger className="w-full sm:w-44 min-h-[40px]">
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
                    className="text-muted-foreground hover:text-foreground min-h-[40px] px-3">
                    Clear filters
                  </Button>
                )}
              </div>
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
                {/* Mobile Stacked Card View (< md) */}
                <div className="md:hidden divide-y divide-border/60">
                  {paginated.map((r) => {
                    const dt = new Date(r.marked_at);
                    const isExpanded = expandedCardIds.has(r.id);
                    return (
                      <div key={r.id} className="p-3.5 space-y-2.5 bg-card hover:bg-muted/15 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm text-foreground">{r.person_name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })} •{" "}
                              {r.status !== "absent"
                                ? dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : "Absent"}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase font-bold shrink-0 ${statusColor[r.status] ?? ""}`}
                          >
                            {r.status}
                          </Badge>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleExpand(r.id)}
                          className="text-xs text-primary font-medium flex items-center gap-1 cursor-pointer pt-0.5"
                        >
                          {isExpanded ? (
                            <>Hide details <ChevronUp className="w-3.5 h-3.5" /></>
                          ) : (
                            <>View details <ChevronDown className="w-3.5 h-3.5" /></>
                          )}
                        </button>

                        {isExpanded && (
                          <div className="pt-2 pb-1 border-t border-border/50 text-xs space-y-1.5 animate-enter-subtle text-muted-foreground">
                            <div className="flex justify-between">
                              <span className="font-medium text-foreground">Department:</span>
                              <span>{r.department || "Unassigned"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium text-foreground">Session:</span>
                              <span className="truncate max-w-[180px] text-right">{r.session_label}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-foreground">Confidence:</span>
                              <span>
                                {r.confidence != null && r.confidence > 0
                                  ? `${(r.confidence * 100).toFixed(1)}% Match`
                                  : "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium text-foreground">Record ID:</span>
                              <span className="font-mono text-[10px]">{r.id.slice(0, 10)}...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (>= md) */}
                <div className="hidden md:block overflow-x-auto">
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
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-border">
                    <p className="text-xs text-muted-foreground order-2 sm:order-1">
                      Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                    </p>
                    <div className="flex items-center gap-2 order-1 sm:order-2">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="min-h-[38px] min-w-[38px]"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-xs sm:text-sm text-muted-foreground px-2">
                        {page} / {totalPages}
                      </span>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="min-h-[38px] min-w-[38px]"
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
