import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import type { AppRole } from "../../lib/types";
import { FEATURES, isFeatureVisibleToRole, type FeatureId } from "../../lib/feature-flags";
import { AppLayout } from "../layout/AppLayout";
import { ComingSoon } from "./ComingSoon";

export function ProtectedRoute({
  children,
  allowedRoles,
  feature,
}: {
  children: ReactNode;
  allowedRoles?: AppRole[];
  feature?: FeatureId;
}) {
  const { session, role, isClientUser, loading } = useAuth();

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-app text-muted text-sm">Loading...</div>;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (isClientUser) {
    return <Navigate to="/client/shipments" replace />;
  }
  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/" replace />;
  }
  if (feature && !isFeatureVisibleToRole(feature, role)) {
    return (
      <AppLayout title={FEATURES[feature].title}>
        <ComingSoon feature={feature} />
      </AppLayout>
    );
  }
  return <>{children}</>;
}
