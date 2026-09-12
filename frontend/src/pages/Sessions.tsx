import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Camera, StopCircle, Calendar, Clock, Building, CheckCircle2 } from "lucide-react";
import { useSessions, useCreateSession, useEndSession } from "@/hooks/useAttendanceQueries";
import { toast } from "sonner";

const Sessions: React.FC = () => {
  const [openCreate, setOpenCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [department, setDepartment] = useState("");

  const { data: allSessions, isLoading } = useSessions();
  const createMutation = useCreateSession();
  const endMutation = useEndSession();
  const navigate = useNavigate();

  const activeSessions = (allSessions || []).filter((s) => s.is_active);
  const pastSessions = (allSessions || []).filter((s) => !s.is_active);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("Please enter a session label");
      return;
    }
    try {
      const created = await createMutation.mutateAsync({
        label: label.trim(),
        department: department.trim() || undefined,
      });
      toast.success(`Session "${created.label}" created`);
      setOpenCreate(false);
      setLabel("");
      setDepartment("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create session");
    }
  };

  const handleEnd = async (id: string, sessionLabel: string) => {
    try {
      await endMutation.mutateAsync(id);
      toast.success(`Session "${sessionLabel}" ended`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to end session");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Attendance Sessions</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage class, lecture, or shift sessions for facial recognition
            </p>
          </div>

          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button className="shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                New Session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Create New Session</DialogTitle>
                  <DialogDescription>
                    Provide a name and optional department for the attendance session.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="session-label">Session Label *</Label>
                    <Input
                      id="session-label"
                      placeholder="e.g. CS101 - Lecture 4 or Morning Shift"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="session-dept">Department / Group (Optional)</Label>
                    <Input
                      id="session-dept"
                      placeholder="e.g. Computer Science"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpenCreate(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Start Session"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h2 className="text-lg font-semibold tracking-tight">Active Sessions ({activeSessions.length})</h2>
          </div>

          {activeSessions.length === 0 ? (
            <Card className="border-dashed border-border/70 bg-muted/10">
              <CardContent className="py-10 text-center space-y-2">
                <Calendar className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-medium text-muted-foreground">No active sessions right now</p>
                <p className="text-xs text-muted-foreground/60">
                  Create a session above or start one directly in Live Attendance.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeSessions.map((s) => (
                <Card key={s.id} className="border-border/70 shadow-sm relative overflow-hidden">
                  <div className="h-1 w-full bg-emerald-500 absolute top-0 left-0" />
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-bold">{s.label}</CardTitle>
                        {s.department && (
                          <CardDescription className="flex items-center gap-1.5 mt-0.5">
                            <Building className="w-3 h-3" />
                            {s.department}
                          </CardDescription>
                        )}
                      </div>
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                        Live
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Started at {new Date(s.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate("/live-attendance", { state: { sessionId: s.id } })}
                      >
                        <Camera className="w-3.5 h-3.5 mr-1.5" />
                        Open Camera
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleEnd(s.id, s.label)}
                        disabled={endMutation.isPending}
                      >
                        <StopCircle className="w-3.5 h-3.5 mr-1.5" />
                        End
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Session History</CardTitle>
            <CardDescription>Completed attendance sessions</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
                Loading sessions...
              </div>
            ) : pastSessions.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No past sessions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold">Session Name</TableHead>
                      <TableHead className="font-semibold">Department</TableHead>
                      <TableHead className="font-semibold">Started At</TableHead>
                      <TableHead className="font-semibold">Ended At</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-right font-semibold">Records</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pastSessions.slice(0, 20).map((s) => (
                      <TableRow key={s.id} className="hover:bg-muted/20">
                        <TableCell className="font-medium">{s.label}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {s.department || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(s.started_at).toLocaleString([], {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.ended_at
                            ? new Date(s.ended_at).toLocaleString([], {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-muted-foreground" />
                            Completed
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/records?sessionId=${s.id}`}>View Attendance</Link>
                          </Button>
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
    </AppLayout>
  );
};

export default Sessions;
