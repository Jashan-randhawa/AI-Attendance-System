import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/auth/AuthContext";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { RoleGuard } from "@/auth/RoleGuard";

import Login from "./pages/Login.tsx";
import Index from "./pages/Index.tsx";
import LiveAttendance from "./pages/LiveAttendance.tsx";
import Sessions from "./pages/Sessions.tsx";
import Records from "./pages/Records.tsx";
import People from "./pages/People.tsx";
import PersonDetails from "./pages/PersonDetails.tsx";
import EnrollPerson from "./pages/EnrollPerson.tsx";
import Reports from "./pages/Reports.tsx";
import UserManagement from "./pages/UserManagement.tsx";
import SystemHealth from "./pages/SystemHealth.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />

            {/* Operator & Admin accessible routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live-attendance"
              element={
                <ProtectedRoute>
                  <LiveAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sessions"
              element={
                <ProtectedRoute>
                  <Sessions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/records"
              element={
                <ProtectedRoute>
                  <Records />
                </ProtectedRoute>
              }
            />

            {/* Admin only routes */}
            <Route
              path="/people"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={["admin"]}>
                    <People />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/people/:id"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={["admin"]}>
                    <PersonDetails />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/enroll"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={["admin"]}>
                    <EnrollPerson />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={["admin"]}>
                    <Reports />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={["admin"]}>
                    <UserManagement />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/system-health"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={["admin"]}>
                    <SystemHealth />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
