import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-app text-muted text-sm">Loading...</div>;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
