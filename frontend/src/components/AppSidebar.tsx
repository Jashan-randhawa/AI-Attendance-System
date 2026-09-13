import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Camera,
  UserPlus,
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Menu,
  X,
  Users,
  Calendar,
  ShieldCheck,
  Activity,
  LogOut,
  Sun,
  Moon,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useTheme } from "@/theme/ThemeContext";
import { useViewMode } from "@/context/ViewModeContext";
import { Badge } from "@/components/ui/badge";

interface NavItemConfig {
  path: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  hasDividerAfter?: boolean;
  badge?: string;
}

const navItems: NavItemConfig[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/live-attendance", label: "Live Attendance", icon: Camera, badge: "AI" },
  { path: "/sessions", label: "Sessions", icon: Calendar },
  { path: "/records", label: "Records", icon: ClipboardList, hasDividerAfter: true },
  { path: "/people", label: "People Directory", icon: Users, adminOnly: true },
  { path: "/enroll", label: "Enroll Person", icon: UserPlus, adminOnly: true },
  { path: "/reports", label: "Reports & Analytics", icon: BarChart3, adminOnly: true },
  { path: "/admin/users", label: "User Accounts", icon: ShieldCheck, adminOnly: true },
  { path: "/admin/system-health", label: "System Health", icon: Activity, adminOnly: true },
];

const AppSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isFitScreen, isFullscreen, toggleFitScreen, toggleFullscreen } = useViewMode();
  const isLight = theme === "light";

  // Desktop hover & pin state (FitTrack design: 68px rail collapsed, 280px expanded on hover)
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    return localStorage.getItem("smart-attend-sidebar-pinned") === "true";
  });
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      localStorage.setItem("smart-attend-sidebar-pinned", String(next));
      return next;
    });
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 160);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    setMobileOpen(false);
    logout();
    navigate("/login");
  };

  const isExpanded = isPinned || isHovered;
  const visibleItems = navItems.filter((item) => !item.adminOnly || role === "admin");

  return (
    <>
      {/* ── Desktop Spacer Rail (prevents layout shifts when sidebar expands on hover) ── */}
      <div
        className={`hidden md:block shrink-0 pointer-events-none transition-[width] duration-200 ease-out ${
          isPinned ? "w-[280px]" : "w-[68px]"
        }`}
      />

      {/* ── Desktop Sidebar: Row-by-Row Aligned (Rail + Panel) ── */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`hidden md:block fixed top-0 left-0 h-screen z-40 select-none transition-[width,box-shadow] duration-200 ease-out overflow-hidden ${
          isExpanded
            ? "w-[280px] shadow-2xl shadow-black/40"
            : "w-[68px] shadow-none"
        }`}
      >
        <div className="w-[280px] h-full flex flex-col py-3 gradient-sidebar border-r border-sidebar-border/80 overflow-x-hidden overflow-y-auto relative select-none">
          {/* Subtle panel tint when expanded */}
          <div className="absolute top-0 left-[68px] right-0 bottom-0 bg-sidebar-muted/20 border-l border-sidebar-border/50 pointer-events-none" />

          {/* Container */}
          <div className="relative z-10 flex flex-col h-full justify-between overflow-x-hidden">
            {/* Top Section */}
            <div className="overflow-x-hidden">
              {/* Row 0: Window Traffic Light Dots & Window Controls */}
              <div className="flex items-center h-7 w-full mb-1">
                <div className="w-[68px] shrink-0 flex items-center justify-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shadow-xs" title="Close" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] shadow-xs" title="Minimize" />
                  <button
                    onClick={toggleFullscreen}
                    title={isFullscreen ? "Exit Fullscreen (Esc / F11)" : "Fit Screen / Fullscreen (F11)"}
                    aria-label="Toggle Fullscreen"
                    className="w-2.5 h-2.5 rounded-full bg-[#10b981] hover:brightness-125 transition-all active:scale-90 cursor-pointer shadow-xs focus:outline-none"
                  />
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between px-3">
                  <span className="text-[10px] font-bold text-sidebar-foreground/40 uppercase tracking-widest">
                    SmartAttend
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={toggleFitScreen}
                      title={isFitScreen ? "Switch to Contained Width (1280px)" : "Fit Screen Width (Full View)"}
                      aria-label="Toggle Fit Screen Width"
                      className={`p-1 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-muted/50 transition-colors cursor-pointer ${
                        isFitScreen ? "text-emerald-400 bg-emerald-500/10" : ""
                      }`}
                    >
                      {isFitScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={togglePin}
                      title={isPinned ? "Unpin sidebar (auto-collapse)" : "Pin sidebar open"}
                      className={`p-1 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-muted/50 transition-colors cursor-pointer ${
                        isPinned ? "text-emerald-400 bg-emerald-500/10" : ""
                      }`}
                    >
                      {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 1: Logo (Rail) <-> Workspace Header (Panel) */}
              <div className="flex items-center h-12 w-full">
                <div className="w-[68px] shrink-0 flex items-center justify-center">
                  <button
                    onClick={() => handleNavigate("/")}
                    className="brand-logo-mark w-10 h-10 rounded-xl flex items-center justify-center border border-emerald-500/30 overflow-hidden shadow-xs cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                    title="SmartAttend Dashboard"
                  >
                    <Camera className="w-5 h-5 text-emerald-400 relative z-10 drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]" />
                  </button>
                </div>
                <div className="flex-1 min-w-0 h-12 flex items-center justify-between px-3">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-sidebar-foreground truncate tracking-tight flex items-center gap-0.5">
                        <span>Smart</span>
                        <span className="brand-logo-text-grad">Attend</span>
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/40 uppercase tracking-wider shrink-0">
                        AI
                      </span>
                    </div>
                    <p className="text-[10px] font-medium tracking-wide text-sidebar-foreground/50 uppercase truncate">
                      Face Recognition
                    </p>
                  </div>
                </div>
              </div>

              {/* Subtle divider below header */}
              <div className="flex items-center h-3.5 w-full my-1">
                <div className="w-[68px] shrink-0 flex items-center justify-center">
                  <div className="w-8 h-px bg-sidebar-border/80" />
                </div>
                <div className="flex-1 min-w-0 flex items-center px-3">
                  <div className="w-full h-px bg-sidebar-border/60" />
                </div>
              </div>

              {/* Navigation Items: Aligned Row-by-Row */}
              <div className="flex flex-col space-y-1 overflow-x-hidden">
                {visibleItems.map((item) => {
                  const active = isActive(item.path);
                  const Icon = item.icon;
                  return (
                    <div key={item.path} className="w-full overflow-x-hidden">
                      <div className="flex items-center h-10 w-full">
                        {/* Rail Cell (Icon button) */}
                        <div className="w-[68px] shrink-0 flex items-center justify-center">
                          <button
                            onClick={() => handleNavigate(item.path)}
                            title={item.label}
                            className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer ${
                              active
                                ? "bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/25 shadow-xs"
                                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-muted/60 border border-transparent"
                            }`}
                          >
                            <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                            {active && (
                              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-emerald-500" />
                            )}
                          </button>
                        </div>

                        {/* Panel Cell (Label + Badge button) */}
                        <div className="flex-1 min-w-0 flex items-center px-2">
                          <button
                            onClick={() => handleNavigate(item.path)}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer w-full text-left ${
                              active
                                ? "bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/20"
                                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-muted/50 border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon
                                className={`w-4 h-4 shrink-0 ${
                                  active ? "text-emerald-400" : "text-sidebar-foreground/50"
                                }`}
                                strokeWidth={active ? 2.2 : 1.8}
                              />
                              <span className="truncate">{item.label}</span>
                            </div>
                            {item.badge && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-700/40 shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Optional Divider */}
                      {item.hasDividerAfter && (
                        <div className="flex items-center h-3 w-full my-1">
                          <div className="w-[68px] shrink-0 flex items-center justify-center">
                            <div className="w-6 h-px bg-sidebar-border/70" />
                          </div>
                          <div className="flex-1 min-w-0 flex items-center px-3">
                            <div className="w-full h-px bg-sidebar-border/50" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Section (Theme toggle & User account) */}
            <div className="mt-auto overflow-x-hidden">
              {/* Divider before footer */}
              <div className="flex items-center h-3 w-full my-1">
                <div className="w-[68px] shrink-0 flex items-center justify-center">
                  <div className="w-8 h-px bg-sidebar-border/80" />
                </div>
                <div className="flex-1 min-w-0 flex items-center px-3">
                  <div className="w-full h-px bg-sidebar-border/60" />
                </div>
              </div>

              {/* Fit Screen View Row: 100% Aligned */}
              <div className="flex items-center h-10 w-full mb-0.5">
                <div className="w-[68px] shrink-0 flex items-center justify-center">
                  <button
                    onClick={toggleFitScreen}
                    title={isFitScreen ? "Switch to Contained Width (1280px)" : "Fit Screen Width (Full View)"}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                      isFitScreen
                        ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-muted/60"
                    }`}
                  >
                    {isFitScreen ? (
                      <Minimize2 className="w-[18px] h-[18px]" />
                    ) : (
                      <Maximize2 className="w-[18px] h-[18px]" />
                    )}
                  </button>
                </div>
                <div className="flex-1 min-w-0 flex items-center px-2">
                  <button
                    onClick={toggleFitScreen}
                    className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isFitScreen ? (
                        <Minimize2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      ) : (
                        <Maximize2 className="w-4 h-4 shrink-0 text-sidebar-foreground/50" />
                      )}
                      <span className="truncate">Fit Screen View</span>
                    </div>
                    <span className={`text-[10px] uppercase font-bold shrink-0 ${isFitScreen ? "text-emerald-400" : "text-sidebar-foreground/40"}`}>
                      {isFitScreen ? "FIT" : "BOXED"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Theme Toggle Row: 100% Aligned */}
              <div className="flex items-center h-10 w-full">
                <div className="w-[68px] shrink-0 flex items-center justify-center">
                  <button
                    onClick={toggleTheme}
                    title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-muted/60 transition-colors cursor-pointer"
                  >
                    {isLight ? <Moon className="w-[18px] h-[18px] text-emerald-400" /> : <Sun className="w-[18px] h-[18px] text-amber-400" />}
                  </button>
                </div>
                <div className="flex-1 min-w-0 flex items-center px-2">
                  <button
                    onClick={toggleTheme}
                    className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isLight ? <Moon className="w-4 h-4 shrink-0 text-emerald-400" /> : <Sun className="w-4 h-4 shrink-0 text-amber-400" />}
                      <span className="truncate">{isLight ? "Dark Mode" : "Light Mode"}</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-sidebar-foreground/40 shrink-0">
                      {isLight ? "OFF" : "ON"}
                    </span>
                  </button>
                </div>
              </div>

              {/* User Account Row: 100% Aligned */}
              <div className="flex items-center h-11 w-full mt-1">
                <div className="w-[68px] shrink-0 flex items-center justify-center">
                  <button
                    onClick={() => handleNavigate("/admin/users")}
                    title={user?.username || "Account Profile"}
                    className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-bold shadow-xs cursor-pointer hover:opacity-90 shrink-0"
                  >
                    {(user?.username || "U")[0].toUpperCase()}
                  </button>
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between px-3">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-xs font-semibold text-sidebar-foreground truncate">
                      {user?.username || "Operator"}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 capitalize ${
                          role === "admin"
                            ? "border-amber-400/50 text-amber-300 bg-amber-400/10"
                            : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                        }`}
                      >
                        {role ?? "user"}
                      </Badge>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    className="p-1.5 rounded-lg text-sidebar-foreground/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile Topbar (< md) ── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 gradient-sidebar flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-sidebar-border/80">
        <div className="flex items-center gap-2">
          <button
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
            className="p-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-border/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="brand-logo-mark w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border border-emerald-500/30 overflow-hidden shadow-xs">
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 relative z-10" />
            </div>
            <span className="text-sm font-bold text-sidebar-foreground flex items-center gap-0.5">
              <span>Smart</span>
              <span className="brand-logo-text-grad">Attend</span>
            </span>
            <Badge
              variant="outline"
              className={`ml-1 text-[9px] px-1.5 py-0 capitalize font-bold ${
                role === "admin"
                  ? "border-amber-400/50 text-amber-300 bg-amber-400/10"
                  : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
              }`}
            >
              {role ?? "user"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg border border-sidebar-border/80 bg-sidebar-muted/60 text-sidebar-foreground hover:bg-sidebar-muted transition-colors cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
            title={isFullscreen ? "Exit Fullscreen" : "Fit Fullscreen"}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-emerald-400" /> : <Maximize2 className="w-4 h-4 text-sidebar-foreground/70" />}
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-sidebar-border/80 bg-sidebar-muted/60 text-sidebar-foreground hover:bg-sidebar-muted transition-colors cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
            title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
            aria-label="Toggle theme"
          >
            {isLight ? <Moon className="w-4 h-4 text-emerald-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      </div>

      {/* ── Mobile Drawer Overlay ── */}
      <div
        onClick={() => setMobileOpen(false)}
        className={`md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* ── Mobile Drawer Panel ── */}
      <div
        className={`md:hidden fixed top-0 left-0 z-50 h-full w-[280px] max-w-[85vw] flex flex-col gradient-sidebar border-r border-sidebar-border/80 shadow-2xl transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Mobile Header with Logo & Close */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-sidebar-border/80">
          <div className="flex items-center gap-2">
            <div className="brand-logo-mark w-8 h-8 rounded-lg flex items-center justify-center border border-emerald-500/30 overflow-hidden shadow-xs">
              <Camera className="w-4 h-4 text-emerald-400 relative z-10" />
            </div>
            <div>
              <span className="text-sm font-bold text-sidebar-foreground flex items-center gap-0.5">
                <span>Smart</span>
                <span className="brand-logo-text-grad">Attend</span>
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-muted/60 transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Navigation List */}
        <div className="flex-1 px-3 py-3 overflow-y-auto space-y-1">
          {visibleItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <div key={item.path}>
                <button
                  onClick={() => handleNavigate(item.path)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium w-full text-left transition-colors cursor-pointer ${
                    active
                      ? "bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/20"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${active ? "text-emerald-400" : "text-sidebar-foreground/50"}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-700/40">
                      {item.badge}
                    </span>
                  )}
                </button>
                {item.hasDividerAfter && (
                  <div className="my-1.5 mx-2 border-b border-sidebar-border/60" />
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile Footer: User Account + Logout + Theme Toggle */}
        <div className="p-3 border-t border-sidebar-border/80 space-y-2 bg-sidebar-muted/30">
          <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-sidebar-muted/50 border border-sidebar-border/60">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                {(user?.username || "U")[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-sidebar-foreground truncate">
                  {user?.username || "Account"}
                </p>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={`text-[8px] px-1 py-0 capitalize ${
                      role === "admin"
                        ? "border-amber-400/50 text-amber-300 bg-amber-400/10"
                        : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    }`}
                  >
                    {role ?? "user"}
                  </Badge>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-sidebar-foreground/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0 ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={toggleFitScreen}
            className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-muted/50 transition-colors cursor-pointer mb-1"
          >
            <div className="flex items-center gap-2.5">
              {isFitScreen ? (
                <Minimize2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-sidebar-foreground/50" />
              )}
              <span>Fit Screen View</span>
            </div>
            <span className={`text-[10px] uppercase font-bold ${isFitScreen ? "text-emerald-400" : "text-sidebar-foreground/40"}`}>
              {isFitScreen ? "FIT" : "BOXED"}
            </span>
          </button>

          <button
            onClick={toggleTheme}
            className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-muted/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              {isLight ? <Moon className="w-4 h-4 text-emerald-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
              <span>{isLight ? "Dark Mode" : "Light Mode"}</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-sidebar-foreground/40">
              {isLight ? "OFF" : "ON"}
            </span>
          </button>
        </div>
      </div>

      {/* ── Mobile Fixed Bottom Tab Bar (< md) ── */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar-background/95 backdrop-blur-md border-t border-sidebar-border/80 px-2 py-1.5 pb-safe flex items-center justify-around shadow-2xl"
      >
        {/* Live Attendance */}
        <button
          type="button"
          onClick={() => handleNavigate("/live-attendance")}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-colors min-h-[46px] cursor-pointer ${
            isActive("/live-attendance")
              ? "text-emerald-400 font-semibold"
              : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
          }`}
        >
          <div className="relative">
            <Camera className="w-5 h-5" />
            <span className="absolute -top-1 -right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Live Scan</span>
        </button>

        {/* Sessions */}
        <button
          type="button"
          onClick={() => handleNavigate("/sessions")}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-colors min-h-[46px] cursor-pointer ${
            isActive("/sessions")
              ? "text-emerald-400 font-semibold"
              : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">Sessions</span>
        </button>

        {/* Records */}
        <button
          type="button"
          onClick={() => handleNavigate("/records")}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-colors min-h-[46px] cursor-pointer ${
            isActive("/records")
              ? "text-emerald-400 font-semibold"
              : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
          }`}
        >
          <ClipboardList className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">Records</span>
        </button>

        {/* Dashboard */}
        <button
          type="button"
          onClick={() => handleNavigate("/")}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-colors min-h-[46px] cursor-pointer ${
            isActive("/")
              ? "text-emerald-400 font-semibold"
              : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">Dashboard</span>
        </button>
      </nav>
    </>
  );
};

export default AppSidebar;
