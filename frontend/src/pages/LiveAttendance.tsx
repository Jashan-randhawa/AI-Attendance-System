import { useState, useRef, useCallback, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Camera, Video, VideoOff, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  sessionsApi, attendanceApi,
  type Session, type IdentifyResult,
} from "@/services/api";

const LiveAttendance = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionLabel, setSessionLabel] = useState("");
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [recognized, setRecognized] = useState<(IdentifyResult & { time: string })[]>([]);
  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsStreaming(true);
    } catch {
      toast.error("Camera access denied. Please allow camera permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const startSession = async () => {
    if (!sessionLabel.trim()) { toast.error("Please enter a session label"); return; }
    try {
      const session = await sessionsApi.create(sessionLabel);
      setActiveSession(session);
      setRecognized([]);
      await startCamera();
      toast.success(`Session "${session.label}" started`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start session");
    }
  };

  const stopSession = async () => {
    if (activeSession) {
      try {
        await sessionsApi.end(activeSession.id);
        toast.success("Session ended");
      } catch { /* ignore */ }
    }
    stopCamera();
    setActiveSession(null);
  };

  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !activeSession) return;
    setCapturing(true);
    try {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85));
      const result = await attendanceApi.mark(activeSession.id, blob);
      if (result.identified.length === 0) {
        toast.info("No faces detected");
      } else {
        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setRecognized((prev) => {
          const ids = new Set(prev.map((r) => r.azure_person_id));
          const newOnes = result.identified
            .filter((r) => !ids.has(r.azure_person_id))
            .map((r) => ({ ...r, time: now }));
          return [...prev, ...newOnes];
        });
        toast.success(`${result.new_records} new attendance record(s) saved`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setCapturing(false);
    }
  }, [activeSession]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Live Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">Capture attendance via webcam</p>
        </div>

        <div className="flex items-end gap-4">
          <div className="flex-1 max-w-sm">
            <label className="text-sm font-medium mb-1.5 block">Session Label</label>
            <Input
              placeholder="e.g. CS301 - Lecture 1"
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
              disabled={isStreaming}
            />
          </div>
          <Button
            onClick={isStreaming ? stopSession : startSession}
            className={isStreaming ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            {isStreaming ? <VideoOff className="w-4 h-4 mr-2" /> : <Video className="w-4 h-4 mr-2" />}
            {isStreaming ? "Stop Session" : "Start Session"}
          </Button>
          {isStreaming && (
            <Button variant="outline" onClick={captureFrame} disabled={capturing}>
              <Zap className="w-4 h-4 mr-2" />
              {capturing ? "Scanning…" : "Capture & Mark"}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-none shadow-sm">
            <CardContent className="p-0">
              <div className="aspect-video bg-foreground/5 rounded-lg flex items-center justify-center relative overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover rounded-lg ${isStreaming ? "block" : "hidden"}`}
                />
                <canvas ref={canvasRef} className="hidden" />
                {isStreaming && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-foreground/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                    <span className="text-xs font-medium text-primary-foreground">
                      LIVE — {activeSession?.label}
                    </span>
                  </div>
                )}
                {!isStreaming && (
                  <div className="text-center space-y-3">
                    <Camera className="w-12 h-12 text-muted-foreground/40 mx-auto" />
                    <p className="text-sm text-muted-foreground">Enter a session label and press "Start Session"</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Recognized ({recognized.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recognized.map((p) => (
                <div key={p.azure_person_id} className="flex items-center justify-between p-2 rounded-md bg-secondary/50">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.time}</p>
                  </div>
                  <Badge className="bg-success text-success-foreground">
                    {(p.confidence * 100).toFixed(1)}%
                  </Badge>
                </div>
              ))}
              {recognized.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No faces recognized yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default LiveAttendance;
