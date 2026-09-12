import React, { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Video, VideoOff, Zap, Users, AlertCircle, CheckCircle2, ShieldCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { attendanceApi, type Session, type IdentifyResult } from "@/services/api";
import { useSessions, useCreateSession, useEndSession } from "@/hooks/useAttendanceQueries";
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

  const activeSessions = (sessions || []).filter((s) => s.is_active);

  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [newSessionLabel, setNewSessionLabel] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [recognized, setRecognized] = useState<RecognizedPerson[]>([]);
  const [lastBoxes, setLastBoxes] = useState<Array<{ box: IdentifyResult["face_box"]; name: string; alreadyMarked: boolean }>>([]);

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

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);
    } catch {
      toast.error("Camera access denied. Please allow camera permissions.");
    }
  }, []);

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
  }, [activeSession, scanning, drawFaceBoxes]);

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
      <div ref={liveRef} className="space-y-6 max-w-7xl mx-auto">
        <PageHeader
          className="gsap-live-header"
          badge="Live Biometrics"
          title="Live Attendance Scanner"
          description="Face detection, identification, and automated attendance marking."
          actions={
            activeSession ? (
              <div className="flex items-center gap-2">
                <Button
                  variant={autoScan ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoScan((v) => !v)}
                  disabled={!isStreaming}
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${autoScan ? "animate-spin" : ""}`} />
                  {autoScan ? "Auto-Scanning Active" : "Enable Auto-Scan"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleEndSession}
                >
                  <VideoOff className="w-3.5 h-3.5 mr-1.5" />
                  End Session
                </Button>
              </div>
            ) : undefined
          }
        />

        {!activeSession ? (
          <Card className="gsap-live-control border-border/60 shadow-sm">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Join Existing Active Session</h3>
                  <div className="flex gap-2">
                    <Select onValueChange={handleSelectSession}>
                      <SelectTrigger className="flex-1">
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

                <div className="space-y-3 md:border-l md:border-border/60 md:pl-6">
                  <h3 className="text-sm font-semibold">Or Start a New Session</h3>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. CS101 Lecture or Morning Shift"
                      value={newSessionLabel}
                      onChange={(e) => setNewSessionLabel(e.target.value)}
                    />
                    <Button onClick={handleStartNewSession} disabled={createSessionMutation.isPending}>
                      <Video className="w-4 h-4 mr-2" />
                      Start
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="gsap-live-control flex flex-wrap items-center justify-between p-3.5 px-5 rounded-xl bg-card border border-border/70 shadow-xs gap-3">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <span className="font-semibold text-sm">{activeSession.label}</span>
                {activeSession.department && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({activeSession.department})
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={captureAndMark}
                disabled={scanning || !isStreaming}
              >
                <Zap className="w-4 h-4 mr-1.5 text-primary" />
                {scanning ? "Processing Face..." : "Capture Frame"}
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-border/60 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="aspect-video bg-neutral-950 rounded-lg flex items-center justify-center relative overflow-hidden">
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
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-sm z-10">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-xs font-medium text-white">LIVE FEED</span>
                  </div>
                )}

                {isStreaming && (scanning || autoScan) && (
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] scanner-laser-beam pointer-events-none z-10" />
                )}

                {!isStreaming && (
                  <div className="text-center space-y-3 p-6">
                    <div className="w-14 h-14 rounded-2xl bg-muted/20 flex items-center justify-center mx-auto text-muted-foreground/60">
                      <Camera className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Camera is Inactive</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                        Select or create an active session above, then grant camera permissions to begin recognizing attendees.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm flex flex-col h-[480px]">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
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
                    Position face in front of the camera and click "Capture Frame" or enable "Auto-Scan".
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
