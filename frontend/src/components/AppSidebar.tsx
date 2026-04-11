import { Link, useLocation } from "react-router-dom";
import { Camera, UserPlus, LayoutDashboard, ClipboardList, BarChart3 } from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/live-attendance", label: "Live Attendance", icon: Camera },
  { to: "/enroll", label: "Enroll Person", icon: UserPlus },
  { to: "/records", label: "Records", icon: ClipboardList },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

const AppSidebar = () => {
  const location = useLocation();

  return (
    <aside className="gradient-sidebar w-64 min-h-screen flex flex-col shrink-0">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
            <Camera className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold text-sidebar-foreground">PresentSir</h1>
            <p className="text-xs text-sidebar-foreground/50">Face Recognition</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-border/50"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/40 text-center">
          Powered by Azure Face API
        </p>
      </div>
    </aside>
  );
};

export default AppSidebar;
