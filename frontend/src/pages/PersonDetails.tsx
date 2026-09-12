import React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Building, Mail, Calendar, User, CheckCircle2, Clock, Trash2, AlertTriangle
} from "lucide-react";
import { usePerson, useAttendanceRecords, useDeletePerson, usePersonReports } from "@/hooks/useAttendanceQueries";
import { toast } from "sonner";

const PersonDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: person, isLoading: loadingPerson } = usePerson(id || "");
  const { data: attendance, isLoading: loadingAttendance } = useAttendanceRecords({ person_id: id });
  const { data: reports } = usePersonReports(90);
  const deleteMutation = useDeletePerson();

  const personStat = reports?.find((r) => r.person_id === id);

  const handleDelete = async () => {
    if (!id || !person) return;
    if (window.confirm(`Are you sure you want to remove ${person.name}?`)) {
      try {
        await deleteMutation.mutateAsync(id);
        toast.success("Person deleted");
        navigate("/people");
      } catch (err: any) {
        toast.error(err?.message || "Failed to delete");
      }
    }
  };

  if (loadingPerson) {
    return (
      <AppLayout>
        <div className="py-20 text-center text-muted-foreground animate-pulse">
          Loading person profile...
        </div>
      </AppLayout>
    );
  }

  if (!person) {
    return (
      <AppLayout>
        <div className="py-20 text-center space-y-4">
          <p className="text-lg font-semibold">Person not found</p>
          <Button asChild variant="outline">
            <Link to="/people">Back to Directory</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/people">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to People Directory
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Delete Person
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-6 text-center space-y-4">
              <div className="relative inline-block">
                {person.photo_url ? (
                  <img
                    src={person.photo_url}
                    alt={person.name}
                    className="w-24 h-24 rounded-full object-cover border-2 border-primary/30 mx-auto shadow-sm"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-3xl mx-auto">
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-emerald-500 border-2 border-card flex items-center justify-center text-white">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>

              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">{person.name}</h2>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">ID: {person.id}</p>
              </div>

              <div className="text-left space-y-2.5 pt-4 border-t border-border/60 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Building className="w-4 h-4" /> Department
                  </span>
                  <span className="font-medium text-foreground">{person.department || "—"}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4" /> Email
                  </span>
                  <span className="font-medium text-foreground">{person.email || "—"}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> Registered
                  </span>
                  <span className="font-medium text-foreground">
                    {new Date(person.enrolled_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-border/60 shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardDescription>Attendance Rate (Last 90 Days)</CardDescription>
                <CardTitle className="text-3xl font-bold">
                  {personStat ? `${personStat.attendance_rate.toFixed(1)}%` : "N/A"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {personStat?.is_defaulter ? (
                  <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                    <AlertTriangle className="w-3 h-3" />
                    Defaulter (&lt;75% Attendance)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    Good Standing
                  </Badge>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardDescription>Present Sessions</CardDescription>
                <CardTitle className="text-3xl font-bold">
                  {personStat?.present_count ?? (attendance?.length || 0)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Out of {personStat?.total_sessions ?? "all recorded"} total sessions
              </CardContent>
            </Card>

            <Card className="sm:col-span-2 border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Recent Attendance Events</CardTitle>
                <CardDescription>Sessions where {person.name} was marked</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingAttendance ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Loading history...</div>
                ) : !attendance || attendance.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No attendance records for this person yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead>Session</TableHead>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendance.slice(0, 10).map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium text-sm">{r.session_label}</TableCell>
                            <TableCell className="text-sm">
                              {new Date(r.marked_at).toLocaleString([], {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </TableCell>
                            <TableCell className="text-sm font-mono">
                              {r.confidence != null ? `${(r.confidence * 100).toFixed(1)}%` : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                                {r.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default PersonDetails;
