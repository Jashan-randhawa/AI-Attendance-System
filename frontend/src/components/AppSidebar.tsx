import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Camera, UserPlus, LayoutDashboard, ClipboardList, BarChart3, Menu, X } from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/live-attendance", label: "Live Attendance", icon: Camera },
  { to: "/enroll", label: "Enroll Person", icon: UserPlus },
  { to: "/records", label: "Records", icon: ClipboardList },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();
  return (
    <nav className="flex-1 p-4 space-y-1">
      {navItems.map((item) => {
        const isActive = location.pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all min-h-[44px] ${
              isActive
                ? "bg-primary/15 text-primary font-medium"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-border/50"
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
};

const SidebarHeader = () => (
  <div className="p-6 border-b border-sidebar-border">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center shrink-0">
        <Camera className="w-5 h-5 text-primary-foreground" />
      </div>
      <div>
        <h1 className="text-base font-bold text-sidebar-foreground">Smart Attend</h1>
        <p className="text-xs text-sidebar-foreground/50">Face Recognition</p>
      </div>
    </div>
  </div>
);

const SidebarFooter = () => (
  <div className="p-4 border-t border-sidebar-border">
    <p className="text-xs text-sidebar-foreground/40 text-center">Powered by Azure Face API</p>
  </div>
);

const AppSidebar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 gradient-sidebar flex items-center gap-3 px-4 py-3 border-b border-sidebar-border">
        <button
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((v) => !v)}
          className="p-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-border/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <Camera className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold text-sidebar-foreground">Smart Attend</span>
        </div>
      </header>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 z-50 h-full w-72 gradient-sidebar flex flex-col transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarHeader />
        <NavLinks onNavigate={() => setMobileOpen(false)} />
        <SidebarFooter />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 min-h-screen gradient-sidebar flex-col shrink-0">
        <SidebarHeader />
        <NavLinks />
        <SidebarFooter />
      </aside>
    </>
  );
};

export default AppSidebar;
