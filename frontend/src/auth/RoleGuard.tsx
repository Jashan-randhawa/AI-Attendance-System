import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "./AuthContext";

interface RoleGuardProps {
  children: React.ReactElement;
  allowedRoles?: ("admin" | "operator")[];
  fallback?: React.ReactElement;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles = ["admin"],
  fallback,
}) => {
  const { role } = useAuth();

  if (!role || !allowedRoles.includes(role)) {
    if (fallback) return fallback;
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Access Restricted</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            This section requires administrator privileges. Your current role is{" "}
            <span className="font-semibold capitalize text-foreground">{role ?? "none"}</span>.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return children;
};
