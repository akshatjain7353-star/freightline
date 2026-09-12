import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import type { AppRole } from "../../lib/types";

export function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: AppRole[] }) {
  const { session, role, loading } = useAuth();

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-app text-muted text-sm">Loading...</div>;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
