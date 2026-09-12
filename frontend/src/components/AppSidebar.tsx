import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Camera, UserPlus, LayoutDashboard, ClipboardList, BarChart3,
  Menu, X, Users, Calendar, ShieldCheck, Activity, LogOut, UserCircle
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/live-attendance", label: "Live Attendance", icon: Camera },
  { to: "/sessions", label: "Sessions", icon: Calendar },
  { to: "/records", label: "Records", icon: ClipboardList },
  { to: "/people", label: "People Directory", icon: Users, adminOnly: true },
  { to: "/enroll", label: "Enroll Person", icon: UserPlus, adminOnly: true },
  { to: "/reports", label: "Reports & Analytics", icon: BarChart3, adminOnly: true },
  { to: "/admin/users", label: "User Accounts", icon: ShieldCheck, adminOnly: true },
  { to: "/admin/system-health", label: "System Health", icon: Activity, adminOnly: true },
];

const NavLinks: React.FC<{ onNavigate?: () => void; role: "admin" | "operator" | null }> = ({
  onNavigate,
  role,
}) => {
  const location = useLocation();

  const visibleItems = navItems.filter((item) => !item.adminOnly || role === "admin");

  return (
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {visibleItems.map((item) => {
        const isActive =
          item.to === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
              isActive
                ? "bg-primary/15 text-primary font-semibold border border-primary/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-border/50 border border-transparent"
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

const UserProfileSection: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    if (onNavigate) onNavigate();
    logout();
    navigate("/login");
  };

  return (
    <div className="p-3 border-t border-sidebar-border/80">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-sidebar-border/50 text-left transition-colors min-h-[44px]">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 border border-primary/25">
              <UserCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">
                {user?.username || "Authenticated"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 capitalize ${
                    role === "admin"
                      ? "border-primary/50 text-primary"
                      : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {role ?? "User"}
                </Badge>
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <p className="text-sm font-semibold">{user?.username}</p>
            <p className="text-xs text-muted-foreground capitalize">Role: {role}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
            <LogOut className="w-4 h-4 mr-2" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const SidebarHeader: React.FC = () => (
  <div className="p-5 border-b border-sidebar-border/80">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-sm border border-white/20">
        <Camera className="w-5 h-5 text-primary-foreground" />
      </div>
      <div>
        <h1 className="text-base font-bold text-sidebar-foreground tracking-tight">Smart Attend</h1>
        <p className="text-[11px] font-medium tracking-wide text-sidebar-foreground/50 uppercase">Face Recognition</p>
      </div>
    </div>
  </div>
);

const AppSidebar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role } = useAuth();

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 gradient-sidebar flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <button
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
            className="p-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-border/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
              <Camera className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-sidebar-foreground">Smart Attend</span>
          </div>
        </div>
      </header>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 z-50 h-full w-72 gradient-sidebar flex flex-col transition-transform duration-300 shadow-2xl ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarHeader />
        <NavLinks role={role} onNavigate={() => setMobileOpen(false)} />
        <UserProfileSection onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 min-h-screen gradient-sidebar flex-col shrink-0 border-r border-sidebar-border/80 shadow-lg sticky top-0 h-screen">
        <SidebarHeader />
        <NavLinks role={role} />
        <UserProfileSection />
      </aside>
    </>
  );
};

export default AppSidebar;
