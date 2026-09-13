import React, { useState } from "react";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, UserPlus, ShieldAlert, KeyRound, Clock, User } from "lucide-react";
import { useUsers, useRegisterUser } from "@/hooks/useAttendanceQueries";
import { toast } from "sonner";

const UserManagement: React.FC = () => {
  const { data: users, isLoading } = useUsers();
  const registerMutation = useRegisterUser();

  const [openCreate, setOpenCreate] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"operator" | "admin">("operator");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter a username and password");
      return;
    }

    try {
      await registerMutation.mutateAsync({
        username: username.trim(),
        password: password.trim(),
        role,
      });
      toast.success(`Account created for '${username}' as ${role}`);
      setOpenCreate(false);
      setUsername("");
      setPassword("");
      setRole("operator");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create user");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 w-full">
        <PageHeader
          badge="Access Control"
          title="User Account Management"
          description="Control access roles, operator credentials, and administrator accounts."
          actions={
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button className="shadow-sm gradient-primary text-white btn-tactile">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add User Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreate}>
                  <DialogHeader>
                    <DialogTitle>Register New User</DialogTitle>
                    <DialogDescription>
                      Create a new operator or administrator login. Passwords must be at least 6 characters.
                    </DialogDescription>
                  </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      placeholder="e.g. jashan_op"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role Permission *</Label>
                    <Select value={role} onValueChange={(v: "operator" | "admin") => setRole(v)}>
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operator">Operator (Live attendance, scanning & viewing records)</SelectItem>
                        <SelectItem value="admin">Administrator (Full access, enrollment, reports & accounts)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={registerMutation.isPending}>
                    {registerMutation.isPending ? "Creating..." : "Create Account"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
            </Dialog>
          }
        />

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Active Accounts
            </CardTitle>
            <CardDescription>
              Users allowed to access the Smart Attendance System
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
                Loading accounts...
              </div>
            ) : !users || users.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No user accounts registered.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Username</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Account Status</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead className="text-right">Access Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id} className="hover:bg-muted/20">
                        <TableCell className="font-semibold text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">
                              <User className="w-4 h-4" />
                            </div>
                            <span>{u.username}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              u.role === "admin"
                                ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {u.role === "admin" ? "Administrator" : "Operator"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                            Active
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {u.role === "admin" ? "Full Control" : "Session Scanning"}
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

export default UserManagement;
