import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users, UserPlus, Search, Trash2, Eye, Building, Calendar, Mail, UserCircle
} from "lucide-react";
import { usePersons, useDeletePerson } from "@/hooks/useAttendanceQueries";
import { toast } from "sonner";
import type { Person } from "@/services/api";

const People: React.FC = () => {
  const { data: persons, isLoading } = usePersons();
  const deleteMutation = useDeletePerson();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);

  const departments = useMemo(() => {
    if (!persons) return [];
    const depts = new Set(persons.map((p) => p.department).filter(Boolean) as string[]);
    return Array.from(depts).sort();
  }, [persons]);

  const filtered = useMemo(() => {
    if (!persons) return [];
    const q = search.toLowerCase();
    return persons.filter((p) => {
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.department ?? "").toLowerCase().includes(q);
      const matchDept = deptFilter === "all" || p.department === deptFilter;
      return matchQuery && matchDept;
    });
  }, [persons, search, deptFilter]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(`Removed ${deleteTarget.name} from enrolled directory`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove person");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        <PageHeader
          badge="Directory Registry"
          title="Enrolled People Directory"
          description="Manage registered students, staff, and their biometric face encodings."
          actions={
            <Button asChild className="shadow-sm gradient-primary text-white btn-tactile">
              <Link to="/enroll">
                <UserPlus className="w-4 h-4 mr-2" />
                Enroll Person
              </Link>
            </Button>
          }
        />

        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search by name, email, or department..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {departments.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto py-1">
                  <Button
                    variant={deptFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDeptFilter("all")}
                    className="text-xs"
                  >
                    All
                  </Button>
                  {departments.map((dept) => (
                    <Button
                      key={dept}
                      variant={deptFilter === dept ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDeptFilter(dept)}
                      className="text-xs shrink-0"
                    >
                      {dept}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Persons List</CardTitle>
                <CardDescription>
                  {filtered.length} active registered subject{filtered.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-16 text-center text-sm text-muted-foreground animate-pulse">
                Loading directory...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <Users className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-semibold">No persons found</p>
                <p className="text-xs text-muted-foreground">
                  Try adjusting your search criteria or register a new person.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="font-semibold">Person</TableHead>
                      <TableHead className="font-semibold">Department</TableHead>
                      <TableHead className="font-semibold">Email</TableHead>
                      <TableHead className="font-semibold">Enrolled On</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id} className="hover:bg-muted/20">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {p.photo_url ? (
                              <img
                                src={p.photo_url}
                                alt={p.name}
                                className="w-9 h-9 rounded-full object-cover border border-border/80"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                {p.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-sm leading-none">{p.name}</p>
                              <p className="text-xs text-muted-foreground font-mono mt-1">
                                ID: {p.id.slice(0, 8)}...
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.department ? (
                            <span className="flex items-center gap-1.5">
                              <Building className="w-3.5 h-3.5 text-muted-foreground" />
                              {p.department}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.email ? (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Mail className="w-3.5 h-3.5" />
                              {p.email}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(p.enrolled_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                            Active
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/people/${p.id}`)}
                            >
                              <Eye className="w-4 h-4 mr-1 text-muted-foreground" />
                              Details
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleteTarget(p)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Enrolled Subject?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete <span className="font-semibold text-foreground">{deleteTarget?.name}</span> and
                remove their biometric facial encodings. They will no longer be recognized in live attendance scans.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteConfirm}
              >
                Delete Subject
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default People;
