import React, { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Camera, Video, VideoOff, Zap, Users, AlertCircle, CheckCircle2,
  ShieldCheck, RefreshCw, Maximize2, Minimize2, SwitchCamera, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { attendanceApi, type Session, type IdentifyResult } from "@/services/api";
import { useSessions, useCreateSession, useEndSession } from "@/hooks/useAttendanceQueries";
import { useViewMode } from "@/context/ViewModeContext";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

interface RecognizedPerson extends IdentifyResult {
  time: string;
}

const LiveAttendance: React.FC = () => {
  const location = useLocation();
  const initialSessionId = (location.state as any)?.sessionId as string | undefined;

  const { data: sessions, refetch: refetchSessions } = useSessions();
  const createSessionMutation = useCreateSession();
  const endSessionMutation = useEndSession();
  const { isFullscreen, toggleFullscreen } = useViewMode();

  const activeSessions = (sessions || []).filter((s) => s.is_active);

  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [newSessionLabel, setNewSessionLabel] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [recognized, setRecognized] = useState<RecognizedPerson[]>([]);
  const [lastBoxes, setLastBoxes] = useState<Array<{ box: IdentifyResult["face_box"]; name: string; alreadyMarked: boolean }>>([]);
  const [lastMatchBanner, setLastMatchBanner] = useState<{ names: string[]; count: number } | null>(null);

  // Mobile detection: default rear camera ('environment') on mobile/tablets, 'user' on desktop
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [facingMode, setFacingMode] = useState<"user" | "environment">(() => (isMobile ? "environment" : "user"));

  const liveRef = useRef<HTMLDivElement>(null);

  const { contextSafe } = useGSAP({ scope: liveRef });

  const triggerMatchFlash = contextSafe(() => {
    gsap.fromTo(
      ".viewfinder-flash",
      { opacity: 0.65, scale: 1 },
      { opacity: 0, scale: 1.01, duration: 0.6, ease: "power2.out" }
    );
  });

  useGSAP(
    () => {
      gsap.from(".gsap-live-header", {
        y: -10,
        opacity: 0,
        duration: 0.35,
        ease: "power2.out",
      });
      gsap.from(".gsap-live-control", {
        y: 12,
        opacity: 0,
        duration: 0.4,
        delay: 0.1,
        ease: "power2.out",
      });
    },
    { scope: liveRef }
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoScanTimerRef = useRef<any>(null);

  useEffect(() => {
    if (initialSessionId && sessions) {
      const match = sessions.find((s) => s.id === initialSessionId && s.is_active);
      if (match) {
        setActiveSession(match);
      }
    }
  }, [initialSessionId, sessions]);

  const startCamera = useCallback(async (targetMode?: "user" | "environment") => {
    const modeToUse = targetMode || facingMode;
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: modeToUse },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        // Fallback if requested facingMode is unsupported
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);
    } catch {
      toast.error("Camera access denied or unavailable. Please grant camera permissions.");
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (autoScanTimerRef.current) {
      clearInterval(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
    setAutoScan(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);

    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
    setLastBoxes([]);
  }, []);

  const switchCamera = useCallback(async () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    toast.info(`Switched to ${nextMode === "environment" ? "Rear" : "Front"} Camera`);
    if (isStreaming) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      await startCamera(nextMode);
    }
  }, [facingMode, isStreaming, startCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleStartNewSession = async () => {
    if (!newSessionLabel.trim()) {
      toast.error("Please enter a session label");
      return;
    }
    try {
      const created = await createSessionMutation.mutateAsync({
        label: newSessionLabel.trim(),
      });
      setActiveSession(created);
      setRecognized([]);
      setNewSessionLabel("");
      await startCamera();
      toast.success(`Session "${created.label}" started`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to start session");
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    const s = activeSessions.find((item) => item.id === sessionId);
    if (s) {
      setActiveSession(s);
      setRecognized([]);
      if (!isStreaming) {
        await startCamera();
      }
    }
  };

  const handleEndSession = async () => {
    if (activeSession) {
      try {
        await endSessionMutation.mutateAsync(activeSession.id);
        toast.success(`Session "${activeSession.label}" closed`);
      } catch (err: any) {
        toast.error(err?.message || "Failed to end session");
      }
    }
    stopCamera();
    setActiveSession(null);
    refetchSessions();
  };

  const drawFaceBoxes = useCallback(
    (
      boxes: Array<{ box: IdentifyResult["face_box"]; name: string; alreadyMarked: boolean }>,
      videoWidth: number,
      videoHeight: number
    ) => {
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, videoWidth, videoHeight);

      boxes.forEach(({ box, name, alreadyMarked }) => {
        const { top, left, width, height } = box;
        const color = alreadyMarked ? "#f59e0b" : "#10b981";

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(left, top, width, height);

        ctx.fillStyle = color;
        const text = alreadyMarked ? `${name} (Marked)` : name;
        ctx.font = "bold 14px sans-serif";
        const textWidth = ctx.measureText(text).width;
        ctx.fillRect(left, Math.max(0, top - 24), textWidth + 12, 24);

        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, left + 6, Math.max(16, top - 7));
      });
    },
    []
  );

  const captureAndMark = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !activeSession || scanning) return;
    setScanning(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to extract frame"));
          },
          "image/jpeg",
          0.85
        );
      });

      const res = await attendanceApi.mark(activeSession.id, blob);

      const detectedBoxes: Array<{
        box: IdentifyResult["face_box"];
        name: string;
        alreadyMarked: boolean;
      }> = [];

      if (res.identified.length === 0) {
        setLastBoxes([]);
        drawFaceBoxes([], canvas.width, canvas.height);
      } else {
        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        res.identified.forEach((p) => {
          detectedBoxes.push({
            box: p.face_box,
            name: p.name,
            alreadyMarked: p.already_marked,
          });
        });

        setLastBoxes(detectedBoxes);
        drawFaceBoxes(detectedBoxes, canvas.width, canvas.height);

        setRecognized((prev) => {
          const existingIds = new Set(prev.map((r) => r.azure_person_id));
          const newEntries = res.identified
            .filter((r) => !existingIds.has(r.azure_person_id))
            .map((r) => ({ ...r, time: now }));
          return [...prev, ...newEntries];
        });

        if (res.new_records > 0) {
          triggerMatchFlash();
          const markedNames = res.identified.filter((p) => !p.already_marked).map((p) => p.name);
          setLastMatchBanner({
            names: markedNames.length ? markedNames : [res.identified[0]?.name || "Attendee"],
            count: res.new_records,
          });
          setTimeout(() => setLastMatchBanner(null), 4500);
          toast.success(`Marked attendance for ${res.new_records} person(s)!`);
        }
      }
    } catch (err: any) {
      if (err?.status === 400 && err?.message?.includes("closed")) {
        toast.error("This session is closed. Ending camera.");
        handleEndSession();
      } else {
        toast.error(err?.message || "Recognition frame error");
      }
    } finally {
      setScanning(false);
    }
  }, [activeSession, scanning, drawFaceBoxes, triggerMatchFlash]);

  useEffect(() => {
    if (autoScan && isStreaming && activeSession) {
      autoScanTimerRef.current = setInterval(() => {
        captureAndMark();
      }, 2500);
    } else {
      if (autoScanTimerRef.current) {
        clearInterval(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    }
    return () => {
      if (autoScanTimerRef.current) {
        clearInterval(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    };
  }, [autoScan, isStreaming, activeSession, captureAndMark]);

  return (
    <AppLayout>
      <div ref={liveRef} className="space-y-4 sm:space-y-6 w-full">
        <PageHeader
          className="gsap-live-header"
          badge="Live Biometrics"
          title="Live Attendance Scanner"
          description="Face detection, identification, and automated attendance marking."
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen (Esc / F11)" : "Fit Fullscreen View (F11)"}
                className="btn-tactile shadow-xs min-h-[38px]"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 mr-1.5" /> Normal View
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 mr-1.5" /> Fullscreen View
                  </>
                )}
              </Button>
              {activeSession && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={switchCamera}
                    title="Switch Camera (Front/Rear)"
                    className="min-h-[38px]"
                  >
                    <SwitchCamera className="w-3.5 h-3.5 mr-1.5" />
                    Flip Camera
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleEndSession}
                    className="min-h-[38px]"
                  >
                    <VideoOff className="w-3.5 h-3.5 mr-1.5" />
                    End Session
                  </Button>
                </>
              )}
            </div>
          }
        />

        {!activeSession ? (
          <Card className="gsap-live-control border-border/60 shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-2.5 sm:space-y-3">
                  <h3 className="text-sm font-semibold">Join Existing Active Session</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select onValueChange={handleSelectSession}>
                      <SelectTrigger className="flex-1 min-h-[44px]">
                        <SelectValue placeholder="Choose an active session..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeSessions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label} {s.department ? `(${s.department})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {activeSessions.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No active sessions available. Start a new one below.
                    </p>
                  )}
                </div>

                <div className="space-y-2.5 sm:space-y-3 md:border-l md:border-border/60 md:pl-6 pt-3 md:pt-0 border-t md:border-t-0 border-border/60">
                  <h3 className="text-sm font-semibold">Or Start a New Session</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="e.g. CS101 Lecture or Morning Shift"
                      value={newSessionLabel}
                      onChange={(e) => setNewSessionLabel(e.target.value)}
                      className="min-h-[44px]"
                    />
                    <Button
                      onClick={handleStartNewSession}
                      disabled={createSessionMutation.isPending}
                      className="min-h-[44px] shrink-0"
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Start
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="gsap-live-control flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-3.5 px-4 sm:px-5 rounded-xl bg-card border border-border/70 shadow-xs gap-2 sm:gap-3">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div className="min-w-0">
                <span className="font-semibold text-sm truncate block">{activeSession.label}</span>
                {activeSession.department && (
                  <span className="text-xs text-muted-foreground">
                    Dept: {activeSession.department}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 sm:pt-0">
              <Button
                variant={isStreaming ? "outline" : "default"}
                size="sm"
                onClick={isStreaming ? stopCamera : () => startCamera()}
                className="min-h-[38px]"
              >
                {isStreaming ? (
                  <>
                    <VideoOff className="w-4 h-4 mr-1.5" /> Stop Camera
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 mr-1.5" /> Start Camera
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={switchCamera}
                title="Switch Camera (Front/Rear)"
                className="min-h-[38px]"
              >
                <SwitchCamera className="w-4 h-4 mr-1.5" />
                <span className="capitalize">{facingMode}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Live Identification Match Banner (Arm's length mobile feedback) */}
        {lastMatchBanner && (
          <div className="p-3 sm:p-4 bg-emerald-500/15 border-2 border-emerald-500/40 rounded-xl flex items-center justify-between gap-3 shadow-md animate-enter-subtle">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  Identified: {lastMatchBanner.names.join(", ")}
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  Attendance recorded successfully in session register
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-600 text-white font-bold shrink-0">
              +{lastMatchBanner.count} Marked
            </Badge>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card className="lg:col-span-2 border-border/60 shadow-sm overflow-hidden flex flex-col">
            <CardContent className="p-0 flex-1 flex flex-col">
              <div className="aspect-video bg-neutral-950 rounded-t-lg flex items-center justify-center relative overflow-hidden touch-action-manipulation">
                <div className="viewfinder-flash absolute inset-0 bg-emerald-500/25 border-2 border-emerald-400 rounded-lg pointer-events-none opacity-0 z-20" />
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover ${isStreaming ? "block" : "hidden"}`}
                />
                <canvas ref={canvasRef} className="hidden" />
                <canvas
                  ref={overlayCanvasRef}
                  className={`absolute inset-0 w-full h-full pointer-events-none ${isStreaming ? "block" : "hidden"}`}
                />

                {isStreaming && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-white/10 shadow-sm z-10">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-[10px] sm:text-xs font-medium text-white">LIVE FEED</span>
                  </div>
                )}

                {isStreaming && (
                  <button
                    type="button"
                    onClick={switchCamera}
                    title={`Switch to ${facingMode === "environment" ? "Front" : "Rear"} Camera`}
                    aria-label="Switch Camera"
                    className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 hover:bg-black/80 backdrop-blur-md px-2.5 py-1 sm:py-1.5 rounded-full border border-white/10 text-white text-[11px] font-medium cursor-pointer transition-colors shadow-sm z-10 min-h-[32px]"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                    <span className="capitalize">{facingMode}</span>
                  </button>
                )}

                {isStreaming && (scanning || autoScan) && (
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] scanner-laser-beam pointer-events-none z-10" />
                )}

                {!isStreaming && (
                  <div className="text-center space-y-2.5 sm:space-y-3 p-6">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-muted/20 flex items-center justify-center mx-auto text-muted-foreground/60">
                      <Camera className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Camera is Inactive</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        {activeSession
                          ? "Click below to activate camera and start scanning."
                          : "Select or start a session above, then enable camera to recognize attendees."}
                      </p>
                    </div>
                    {activeSession && (
                      <Button
                        type="button"
                        onClick={() => startCamera()}
                        className="mt-2 gradient-primary text-white shadow-sm min-h-[44px]"
                      >
                        <Camera className="w-4 h-4 mr-2" /> Activate Camera
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Large Thumb-Reachable Primary Action Controls */}
              {isStreaming && (
                <div className="p-3 sm:p-4 bg-card border-t border-border/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                  <Button
                    type="button"
                    onClick={captureAndMark}
                    disabled={scanning}
                    size="lg"
                    className="flex-1 h-12 text-sm sm:text-base font-semibold gradient-primary text-white shadow-md btn-tactile min-h-[48px]"
                  >
                    <Zap className="w-5 h-5 mr-2 text-amber-300" />
                    {scanning ? "Recognizing Attendee..." : "Identify / Mark Attendance"}
                  </Button>
                  <Button
                    type="button"
                    variant={autoScan ? "default" : "outline"}
                    onClick={() => setAutoScan((v) => !v)}
                    className="h-11 min-h-[44px] shrink-0"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${autoScan ? "animate-spin" : ""}`} />
                    {autoScan ? "Auto-Scanning Active" : "Enable Auto-Scan"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm flex flex-col max-h-[480px]">
            <CardHeader className="p-3.5 sm:p-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Recognized ({recognized.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Marked during current session
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 flex-1 overflow-y-auto space-y-2">
              {recognized.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground space-y-2">
                  <ShieldCheck className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-xs">No attendees identified yet</p>
                  <p className="text-[11px] text-muted-foreground/70">
                    Position face in front of the camera and click "Identify / Mark Attendance" or enable "Auto-Scan".
                  </p>
                </div>
              ) : (
                recognized.map((p) => (
                  <div
                    key={p.azure_person_id}
                    className="animate-enter-subtle flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/50 hover:bg-muted/70 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.time}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[11px]">
                        {(p.confidence * 100).toFixed(0)}% Match
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default LiveAttendance;
