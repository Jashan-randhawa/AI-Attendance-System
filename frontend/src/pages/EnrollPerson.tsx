import { useState, useRef, useCallback, useEffect } from "react";

import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Camera, Upload, UserPlus, CheckCircle, RefreshCw, Trash2, Video, VideoOff,
  AlertCircle, CheckCircle2, Loader2, ScanFace,
} from "lucide-react";
import { toast } from "sonner";
import { personsApi, type Person } from "@/services/api";

type CaptureMode = "camera" | "upload";

interface PhotoQuality {
  photo: number;
  ok: boolean;
  det_score: number | null;
  face_size: [number, number] | null;
  reason: string;
}

interface AnalysisReport {
  total: number;
  valid: number;
  invalid: number;
  results: PhotoQuality[];
}

const EnrollPerson = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [mode, setMode] = useState<CaptureMode>("camera");

  // Camera state
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImages, setCapturedImages] = useState<Blob[]>([]);
  const [capturedPreviews, setCapturedPreviews] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Upload state
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Quality analysis state
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Submission state
  const [enrolled, setEnrolled] = useState<Person | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Camera helpers ─────────────────────────────────────────────────────────
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

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    if (capturedImages.length >= 5) {
      toast.warning("Maximum 5 photos captured. Remove one to add more.");
      return;
    }
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = canvas.toDataURL("image/jpeg");
      setCapturedImages((prev) => [...prev, blob]);
      setCapturedPreviews((prev) => [...prev, url]);
      setAnalysisReport(null); // reset analysis when photos change
      toast.success(`Photo ${capturedImages.length + 1} captured!`);
    }, "image/jpeg", 0.9);
  }, [capturedImages.length]);

  const removeCapture = (index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index));
    setCapturedPreviews((prev) => prev.filter((_, i) => i !== index));
    setAnalysisReport(null);
  };

  // ── Photo quality analysis ─────────────────────────────────────────────────
  const analyzePhotos = async () => {
    const photos: (Blob | File)[] = mode === "camera" ? capturedImages : uploadedFiles;
    if (photos.length === 0) {
      toast.error("Add at least one photo first.");
      return;
    }
    setAnalyzing(true);
    setAnalysisReport(null);
    try {
      const fd = new FormData();
      photos.forEach((p, i) => fd.append("photos", p, `photo_${i + 1}.jpg`));
      const report = await personsApi.analyzePhotos(fd) as AnalysisReport;
      setAnalysisReport(report);
      if (report.invalid > 0) {
        toast.warning(`${report.invalid} photo(s) have quality issues. Check the report below.`);
      } else {
        toast.success("All photos passed quality check!");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Please enter a name"); return; }

    const photos: (Blob | File)[] = mode === "camera" ? capturedImages : uploadedFiles;
    if (photos.length === 0) {
      toast.error(mode === "camera"
        ? "Please capture at least 1 photo"
        : "Please upload at least 1 photo");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      if (email) fd.append("email", email);
      if (department) fd.append("department", department);
      photos.forEach((p, i) =>
        fd.append("photos", p, `photo_${i + 1}.jpg`)
      );
      const person = await personsApi.enroll(fd);
      setEnrolled(person);
      stopCamera();
      toast.success(`${person.name} enrolled successfully!`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Enrollment failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setName(""); setEmail(""); setDepartment("");
    setCapturedImages([]); setCapturedPreviews([]);
    setUploadedFiles([]);
    setEnrolled(null);
    setAnalysisReport(null);
    stopCamera();
  };

  const photoCount = mode === "camera" ? capturedImages.length : uploadedFiles.length;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (enrolled) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-2xl">
          <Card className="border-none shadow-sm">
            <CardContent className="p-12 text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-success mx-auto" />
              <h2 className="text-xl font-bold">{enrolled.name} Enrolled!</h2>
              <p className="text-muted-foreground text-sm">
                {photoCount} photo(s) processed and stored.
              </p>
              {enrolled.department && (
                <p className="text-sm">Department: <strong>{enrolled.department}</strong></p>
              )}
              <Button onClick={handleReset}>Enroll Another Person</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Enroll New Person</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Register a student or employee for face recognition
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Person Details */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Person Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Jashanpreet Singh" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input id="email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="jash@example.com" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dept">Department / Class</Label>
                <Input id="dept" value={department}
                  onChange={(e) => setDepartment(e.target.value)} placeholder="Computer Science" />
              </div>
            </CardContent>
          </Card>

          {/* Photo Capture */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Capture Photos
                  <Badge variant="outline">{photoCount}/5</Badge>
                </CardTitle>
                <div className="flex gap-2">
                  <Button type="button" size="sm"
                    variant={mode === "camera" ? "default" : "outline"}
                    onClick={() => { setMode("camera"); stopCamera(); setAnalysisReport(null); }}>
                    <Camera className="w-3.5 h-3.5 mr-1.5" /> Camera
                  </Button>
                  <Button type="button" size="sm"
                    variant={mode === "upload" ? "default" : "outline"}
                    onClick={() => { setMode("upload"); stopCamera(); setAnalysisReport(null); }}>
                    <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* ── Camera Mode ── */}
              {mode === "camera" && (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Capture 3–5 photos from different angles for best accuracy.
                  </p>

                  <div className="relative aspect-video bg-foreground/5 rounded-lg overflow-hidden flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`absolute inset-0 w-full h-full object-cover ${isStreaming ? "block" : "hidden"}`}
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    {isStreaming && (
                      <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs text-white font-medium">LIVE</span>
                      </div>
                    )}
                    {!isStreaming && (
                      <div className="text-center space-y-2">
                        <Camera className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                        <p className="text-sm text-muted-foreground">Camera is off</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline"
                      onClick={isStreaming ? stopCamera : startCamera}
                      className={isStreaming ? "text-destructive border-destructive" : ""}>
                      {isStreaming
                        ? <><VideoOff className="w-4 h-4 mr-2" /> Stop Camera</>
                        : <><Video className="w-4 h-4 mr-2" /> Start Camera</>}
                    </Button>
                    {isStreaming && (
                      <Button type="button" onClick={capturePhoto}
                        disabled={capturedImages.length >= 5}>
                        <Camera className="w-4 h-4 mr-2" /> Capture Photo
                      </Button>
                    )}
                  </div>

                  {capturedPreviews.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{capturedPreviews.length} photo(s) captured:</p>
                      <div className="flex flex-wrap gap-3">
                        {capturedPreviews.map((src, i) => {
                          const quality = analysisReport?.results[i];
                          return (
                            <div key={i} className="relative group">
                              <img src={src} alt={`Capture ${i + 1}`}
                                className={`w-20 h-20 object-cover rounded-lg border-2 ${
                                  quality
                                    ? quality.ok
                                      ? "border-green-500"
                                      : "border-red-500"
                                    : "border-border"
                                }`} />
                              {quality && (
                                <div className="absolute top-1 right-1">
                                  {quality.ok
                                    ? <CheckCircle2 className="w-4 h-4 text-green-500 bg-white rounded-full" />
                                    : <AlertCircle className="w-4 h-4 text-red-500 bg-white rounded-full" />}
                                </div>
                              )}
                              <button type="button"
                                onClick={() => removeCapture(i)}
                                className="absolute -top-2 -right-2 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1 rounded">
                                {i + 1}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Upload Mode ── */}
              {mode === "upload" && (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Upload 3–5 clear photos from different angles.
                  </p>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {uploadedFiles.length > 0
                        ? `${uploadedFiles.length} file(s) selected`
                        : "Click to upload JPG/PNG"}
                    </p>
                    <input type="file" className="hidden" accept="image/jpeg,image/png"
                      multiple
                      onChange={(e) => {
                        setUploadedFiles(Array.from(e.target.files || []));
                        setAnalysisReport(null);
                      }} />
                  </label>
                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {uploadedFiles.map((f, i) => {
                        const quality = analysisReport?.results[i];
                        return (
                          <div key={i} className="relative group">
                            <img src={URL.createObjectURL(f)} alt={f.name}
                              className={`w-20 h-20 object-cover rounded-lg border-2 ${
                                quality
                                  ? quality.ok
                                    ? "border-green-500"
                                    : "border-red-500"
                                  : "border-border"
                              }`} />
                            {quality && (
                              <div className="absolute top-1 right-1">
                                {quality.ok
                                  ? <CheckCircle2 className="w-4 h-4 text-green-500 bg-white rounded-full" />
                                  : <AlertCircle className="w-4 h-4 text-red-500 bg-white rounded-full" />}
                              </div>
                            )}
                            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1 rounded">
                              {i + 1}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Quality Analysis Button ── */}
              {photoCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={analyzePhotos}
                  disabled={analyzing}
                  className="w-full"
                >
                  {analyzing
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing photos…</>
                    : <><ScanFace className="w-4 h-4 mr-2" /> Check Photo Quality</>}
                </Button>
              )}

              {/* ── Quality Report ── */}
              {analysisReport && (
                <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Quality Report</p>
                    <Badge variant={analysisReport.invalid === 0 ? "default" : "destructive"}>
                      {analysisReport.valid}/{analysisReport.total} passed
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {analysisReport.results.map((r) => (
                      <div key={r.photo} className={`flex items-start gap-2 text-xs p-2 rounded ${
                        r.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                      }`}>
                        {r.ok
                          ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                        <div>
                          <span className="font-medium">Photo {r.photo}: </span>
                          {r.ok
                            ? <>Good quality{r.det_score ? ` (score: ${r.det_score})` : ""}{r.face_size ? `, face ${r.face_size[0]}×${r.face_size[1]}px` : ""}</>
                            : r.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                  {analysisReport.invalid > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Photos with issues will be skipped during enrollment. Remove and re-take them for best results.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={loading || photoCount === 0}>
              <UserPlus className="w-4 h-4 mr-2" />
              {loading ? "Enrolling…" : `Enroll Person (${photoCount} photo${photoCount !== 1 ? "s" : ""})`}
            </Button>
            <Button type="button" variant="outline" onClick={handleReset}>
              <RefreshCw className="w-4 h-4 mr-2" /> Reset
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default EnrollPerson;
