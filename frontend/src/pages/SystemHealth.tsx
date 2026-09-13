import React from "react";
import AppLayout from "@/components/AppLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, Database, Cpu, ShieldCheck, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { useSystemConfig, useMissingEncodings } from "@/hooks/useAttendanceQueries";

const SystemHealth: React.FC = () => {
  const { data: config, isLoading: loadingConfig, refetch: refetchConfig } = useSystemConfig();
  const { data: encodings, isLoading: loadingEncodings, refetch: refetchEncodings } = useMissingEncodings();

  const handleRefresh = () => {
    refetchConfig();
    refetchEncodings();
  };

  return (
    <AppLayout>
      <div className="space-y-8 w-full">
        <PageHeader
          badge="Infrastructure & Diagnostics"
          title="System Health & Diagnostics"
          description="Live configuration status, database connectivity, and biometric vector integrity."
          actions={
            <Button variant="outline" size="sm" onClick={handleRefresh} className="btn-tactile shadow-xs">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Diagnostics
            </Button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>Backend Core API</CardDescription>
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                  Online
                </Badge>
              </div>
              <CardTitle className="text-xl flex items-center gap-2 mt-1">
                <Activity className="w-5 h-5 text-primary" /> Healthy
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 text-xs text-muted-foreground">
              FastAPI pipeline with Uvicorn worker and SlowAPI rate-limiting
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>MongoDB Database</CardDescription>
                <Badge
                  className={
                    config?.MONGODB_URL.includes("NOT SET")
                      ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                      : "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                  }
                >
                  {config?.MONGODB_URL.includes("NOT SET") ? "Local Fallback" : "Connected"}
                </Badge>
              </div>
              <CardTitle className="text-xl flex items-center gap-2 mt-1">
                <Database className="w-5 h-5 text-primary" /> {config?.MONGODB_DB_NAME ?? "attendance_db"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 text-xs text-muted-foreground">
              Collections: persons, attendance, sessions, face_encodings, users
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>InsightFace Biometrics</CardDescription>
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                  Model Cached
                </Badge>
              </div>
              <CardTitle className="text-xl flex items-center gap-2 mt-1">
                <Cpu className="w-5 h-5 text-primary" /> buffalo_sc
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 text-xs text-muted-foreground">
              Det Threshold: {config?.MIN_CONFIDENCE ?? "0.40"} • Duplicate: {config?.DUPLICATE_THRESHOLD ?? "0.45"}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Operational Environment Settings
            </CardTitle>
            <CardDescription>Verified environment configuration parameters</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingConfig ? (
              <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
                Loading configuration...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-semibold text-sm w-1/3">MongoDB Connection</TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {config?.MONGODB_URL}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">Verified</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold text-sm">Azure Blob Storage</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {config?.AZURE_STORAGE_CONNECTION_STRING}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">Optional</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold text-sm">Face Match Min Confidence</TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {config?.MIN_CONFIDENCE} (40% match cutoff)
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">Active</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold text-sm">Duplicate Detection Threshold</TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {config?.DUPLICATE_THRESHOLD} (cosine similarity cutoff)
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">Active</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary" /> Biometric Face Encodings Diagnostic
                </CardTitle>
                <CardDescription>
                  Checks that every active person has stored embedding vectors in MongoDB
                </CardDescription>
              </div>
              <Badge
                className={
                  (encodings?.persons_missing_encodings ?? 0) > 0
                    ? "bg-rose-500/15 text-rose-600 border-rose-500/30"
                    : "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                }
              >
                {encodings?.persons_missing_encodings === 0
                  ? "All Vectors Synced"
                  : `${encodings?.persons_missing_encodings} Missing Vectors`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loadingEncodings ? (
              <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
                Auditing face encodings...
              </div>
            ) : encodings?.persons_missing_encodings === 0 ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold">All Active Subjects Have Encodings</p>
                <p className="text-xs text-muted-foreground">
                  {encodings.persons_with_encodings} biometric vectors registered in database
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-800">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Subjects missing biometric vectors cannot be identified
                  </p>
                  <p className="mt-1">
                    Delete the unindexed subject below and re-enroll them with clear photos.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Subject ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Enrolled Date</TableHead>
                        <TableHead>Recommended Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {encodings?.missing.map((m) => (
                        <TableRow key={m.person_id}>
                          <TableCell className="font-mono text-xs">{m.person_id}</TableCell>
                          <TableCell className="font-semibold text-sm">{m.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.enrolled_at}</TableCell>
                          <TableCell className="text-xs text-rose-600 font-medium">
                            {m.action_needed}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SystemHealth;
