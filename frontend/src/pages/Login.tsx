import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Camera, Lock, User, AlertCircle, Loader2, Eye, EyeOff,
  ShieldCheck, Zap, BarChart3, CheckCircle2, Maximize2, Minimize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/auth/AuthContext";
import { useViewMode } from "@/context/ViewModeContext";
import ThemeToggle from "@/components/ThemeToggle";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const Login: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const { login, isAuthenticated, user } = useAuth();
  const { isFullscreen, toggleFullscreen } = useViewMode();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || "/";

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, user, navigate, from]);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.from(".gsap-hero-content", {
        opacity: 0,
        x: -24,
        duration: 0.5,
      })
        .from(
          ".gsap-form-header",
          {
            opacity: 0,
            y: 16,
            duration: 0.4,
          },
          "-=0.25"
        )
        .from(
          ".gsap-form-field",
          {
            opacity: 0,
            y: 12,
            duration: 0.35,
            stagger: 0.08,
          },
          "-=0.2"
        );
    },
    { scope: containerRef }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please provide both username and password.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Invalid credentials. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (role: "operator" | "admin") => {
    if (role === "admin") {
      setUsername("admin");
      setPassword("admin123");
    } else {
      setUsername("operator");
      setPassword("operator123");
    }
    setError(null);
  };

  return (
    <div
      ref={containerRef}
      className="h-screen max-h-screen h-[100dvh] max-h-[100dvh] w-full flex flex-col lg:flex-row bg-background text-foreground transition-colors duration-200 selection:bg-emerald-500/20 overflow-hidden"
    >
      {/* ── Left Hero Panel (FitTrack / Luffu Editorial Treatment) ── */}
      <div className="hidden lg:flex flex-[1.1] xl:flex-[1.15] h-full relative overflow-hidden flex-col justify-between p-6 lg:p-8 xl:p-10 2xl:p-12 border-r border-border/80 shrink-0">
        {/* Ambient Gradient Wash (Warm Golden Hour & Emerald Sheen) */}
        <div className="absolute inset-0 pointer-events-none transition-opacity duration-300 dark:opacity-0 bg-[radial-gradient(110%_85%_at_12%_8%,rgba(255,224,163,0.92)_0%,transparent_52%),radial-gradient(130%_95%_at_90%_100%,rgba(16,185,129,0.3)_0%,transparent_62%),linear-gradient(160deg,#f5ebd0_0%,#dfc495_40%,#87a094_100%)]" />
        <div className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-300 dark:opacity-100 bg-[radial-gradient(110%_85%_at_12%_8%,rgba(201,147,47,0.22)_0%,transparent_52%),radial-gradient(130%_95%_at_90%_100%,rgba(16,185,129,0.18)_0%,transparent_62%),linear-gradient(160deg,#1c2b30_0%,#141b1e_45%,#0d1112_100%)]" />

        {/* Top brand header */}
        <div className="relative z-10 gsap-hero-content flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 xl:gap-3">
            <div className="brand-logo-mark w-9 h-9 xl:w-11 xl:h-11 rounded-xl flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-md">
              <Camera className="w-4 h-4 xl:w-5 xl:h-5 text-emerald-400 relative z-10 drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]" />
            </div>
            <div>
              <span className="font-bold text-base xl:text-lg tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
                <span>Smart</span>
                <span className="brand-logo-text-grad">Attend</span>
                <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/40 uppercase tracking-wider">
                  AI
                </span>
              </span>
              <p className="text-[10px] xl:text-[11px] font-medium tracking-wide text-slate-600 dark:text-slate-400 uppercase">
                Biometric Surveillance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1 xl:px-3 xl:py-1.5 rounded-full bg-white/50 dark:bg-slate-900/60 border border-white/60 dark:border-slate-800 text-[11px] xl:text-xs font-medium backdrop-blur-xs text-slate-700 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Operational v2.4</span>
          </div>
        </div>

        {/* Center Editorial Copy */}
        <div className="relative z-10 gsap-hero-content max-w-lg my-auto py-2 xl:py-4 shrink-0">
          <p className="text-[11px] xl:text-xs font-semibold tracking-wider text-emerald-800 dark:text-emerald-400 uppercase font-sans mb-2 xl:mb-3">
            Effortless Facial Attendance
          </p>
          <h1 className="font-display text-2xl lg:text-3xl xl:text-4xl font-normal tracking-tight text-slate-900 dark:text-white leading-[1.15] mb-3 xl:mb-4">
            Every face recognized, every record verified with calm precision.
          </h1>
          <p className="text-xs xl:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans mb-4 xl:mb-6">
            High-performance face detection, 512-dimension vector indexing, and automated operational intelligence — engineered to fit into your institutional rhythm.
          </p>

          <div className="grid grid-cols-3 gap-2 xl:gap-3">
            <div className="p-2.5 xl:p-3 rounded-xl bg-white/45 dark:bg-slate-900/50 border border-white/60 dark:border-slate-800/80 backdrop-blur-xs">
              <Zap className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-emerald-600 dark:text-emerald-400 mb-1 xl:mb-1.5" />
              <p className="text-xs font-bold text-slate-900 dark:text-white">Sub-second</p>
              <p className="text-[10px] xl:text-[11px] text-slate-600 dark:text-slate-400">Scan Latency</p>
            </div>
            <div className="p-2.5 xl:p-3 rounded-xl bg-white/45 dark:bg-slate-900/50 border border-white/60 dark:border-slate-800/80 backdrop-blur-xs">
              <ShieldCheck className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-amber-600 dark:text-amber-400 mb-1 xl:mb-1.5" />
              <p className="text-xs font-bold text-slate-900 dark:text-white">RBAC + JWT</p>
              <p className="text-[10px] xl:text-[11px] text-slate-600 dark:text-slate-400">Zero Trust Auth</p>
            </div>
            <div className="p-2.5 xl:p-3 rounded-xl bg-white/45 dark:bg-slate-900/50 border border-white/60 dark:border-slate-800/80 backdrop-blur-xs">
              <BarChart3 className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-emerald-600 dark:text-emerald-400 mb-1 xl:mb-1.5" />
              <p className="text-xs font-bold text-slate-900 dark:text-white">Real-Time</p>
              <p className="text-[10px] xl:text-[11px] text-slate-600 dark:text-slate-400">Audit Analytics</p>
            </div>
          </div>
        </div>

        {/* Ambient bottom wordmark */}
        <div className="relative z-0 select-none pointer-events-none mt-auto pt-2 shrink-0">
          <span className="font-display text-4xl lg:text-5xl xl:text-6xl tracking-tight leading-none text-slate-900/10 dark:text-white/5 block whitespace-nowrap overflow-hidden text-ellipsis">
            SmartAttend
          </span>
        </div>
      </div>

      {/* ── Right Form Panel (Parchment / Deep Ink) ── */}
      <div className="flex-1 h-full flex flex-col justify-between p-4 sm:p-6 md:p-8 lg:p-8 xl:p-10 relative bg-background text-foreground transition-colors duration-200 overflow-y-auto">
        {/* Top corner utilities */}
        <div className="flex items-center justify-between w-full mb-3 lg:mb-4 shrink-0">
          <div className="lg:hidden flex items-center gap-2">
            <div className="brand-logo-mark w-7 h-7 rounded-lg flex items-center justify-center border border-emerald-500/30">
              <Camera className="w-3.5 h-3.5 text-emerald-400 relative z-10" />
            </div>
            <span className="text-sm font-bold text-foreground">
              Smart<span className="brand-logo-text-grad">Attend</span>
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fit to Fullscreen Window"}
              aria-label="Toggle Fullscreen"
              className="p-2 rounded-xl border border-border/80 bg-card/80 text-foreground hover:bg-accent/15 transition-all duration-200 cursor-pointer shadow-xs min-h-[36px] min-w-[36px] flex items-center justify-center btn-tactile"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              )}
            </button>
            <ThemeToggle variant="icon" />
          </div>
        </div>

        {/* Main form container */}
        <div className="w-full max-w-sm sm:max-w-md mx-auto space-y-3.5 lg:space-y-4 my-auto shrink-0 py-2">
          <div className="gsap-form-header space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Biometric Verification Gateway</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-normal tracking-tight text-foreground">
              Welcome back
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-sans">
              Sign in with your operator or administrator credentials to manage attendance streams.
            </p>
          </div>

          {/* Quick Preset Selector */}
          <div className="gsap-form-header flex items-center gap-1.5 p-1 bg-secondary/70 rounded-xl border border-border/80">
            <button
              type="button"
              onClick={() => handleQuickFill("operator")}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all ${
                username === "operator"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Fill Operator
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("admin")}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all ${
                username === "admin"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Fill Admin
            </button>
          </div>

          {error && (
            <Alert variant="destructive" className="py-2 rounded-xl animate-enter-subtle">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="gsap-form-field space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  autoFocus
                  placeholder="operator or admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 h-10 rounded-xl bg-card border-border/80 text-foreground text-xs sm:text-sm placeholder:text-muted-foreground/60 focus-visible:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="gsap-form-field space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                  Password
                </label>
                <span className="text-[10px] text-muted-foreground">Default: operator123</span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-9 h-10 rounded-xl bg-card border-border/80 text-foreground text-xs sm:text-sm placeholder:text-muted-foreground/60 focus-visible:ring-emerald-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 cursor-pointer transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="gsap-form-field pt-1">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 gradient-primary text-white font-medium rounded-xl shadow-xs btn-tactile text-xs sm:text-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Authenticating Session...
                  </>
                ) : (
                  "Sign In to Smart Attend"
                )}
              </Button>
            </div>
          </form>

          <div className="gsap-form-field p-2.5 sm:p-3 rounded-xl border border-border/70 bg-card/60 text-[11px] sm:text-xs text-muted-foreground space-y-0.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Demo Credentials
            </p>
            <p><strong>Admin:</strong> admin / admin123 (full directory, config & user creation)</p>
            <p><strong>Operator:</strong> operator / operator123 (scanner & records operations)</p>
          </div>
        </div>

        {/* Bottom security assurance */}
        <div className="mt-3 lg:mt-4 text-center text-[11px] text-muted-foreground shrink-0">
          Protected by SlowAPI rate limiting & cryptographic per-user JWT verification
        </div>
      </div>
    </div>
  );
};

export default Login;
