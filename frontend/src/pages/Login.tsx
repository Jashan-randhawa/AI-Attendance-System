import React, { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Camera, Lock, User, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/auth/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const Login: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.from(".gsap-login-logo", {
        scale: 0.85,
        opacity: 0,
        duration: 0.45,
      })
        .from(
          ".gsap-login-title",
          {
            y: 12,
            opacity: 0,
            duration: 0.35,
          },
          "-=0.2"
        )
        .from(
          ".gsap-login-card",
          {
            y: 20,
            opacity: 0,
            duration: 0.45,
          },
          "-=0.15"
        )
        .from(
          ".gsap-login-field",
          {
            y: 8,
            opacity: 0,
            duration: 0.3,
            stagger: 0.08,
          },
          "-=0.2"
        );
    },
    { scope: containerRef }
  );

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || "/";

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

  return (
    <div ref={containerRef} className="flex min-h-screen items-center justify-center bg-background p-4 relative">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle variant="icon" />
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="gsap-login-logo brand-logo-mark w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border border-emerald-500/30 overflow-hidden">
            <Camera className="w-7 h-7 text-emerald-400 relative z-10 drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]" />
          </div>
          <div className="gsap-login-title">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-1.5">
              <span>Smart</span>
              <span className="brand-logo-text-grad">Attend</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/40 uppercase tracking-wider">
                AI
              </span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to access live attendance and administrative tools
            </p>
          </div>
        </div>

        <Card className="gsap-login-card border-border/80 shadow-md backdrop-blur-sm bg-card/95 rounded-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold">Account Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              <div className="gsap-login-field space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
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
                    className="pl-9 bg-background/50 border-border/80 focus-visible:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="gsap-login-field space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 bg-background/50 border-border/80 focus-visible:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="gsap-login-field">
                <Button
                  type="submit"
                  className="w-full mt-2 gradient-primary text-white shadow-sm btn-tactile font-medium"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Protected by role-based access control & per-user signed JWT tokens
        </p>
      </div>
    </div>
  );
};

export default Login;
