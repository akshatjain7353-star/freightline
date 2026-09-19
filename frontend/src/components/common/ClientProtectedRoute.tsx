import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import { ClientPortalLayout } from "../layout/ClientPortalLayout";

export function ClientProtectedRoute({ children }: { children: ReactNode }) {
  const { session, role, isClientUser, loading } = useAuth();

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-app text-muted text-sm">Loading...</div>;
  }
  if (!session) {
    return <Navigate to="/client/login" replace />;
  }
  if (role) {
    return <Navigate to="/" replace />;
  }
  if (!isClientUser) {
    return (
      <ClientPortalLayout title="Tracking">
        <div className="text-sm text-secondary bg-surface border border-border rounded p-4">
          This login is not linked to a client account. Ask Time Bound to insert a{" "}
          <span className="font-mono text-xs">client_users</span> row for your Auth user.
        </div>
      </ClientPortalLayout>
    );
  }
  return <>{children}</>;
}
