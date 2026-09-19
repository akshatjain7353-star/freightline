/**
 * Sidebar/route gating uses this static catalog so ops_only never sees
 * unfinished items even if /api/capabilities is unreachable.
 *
 * Source of truth: repo-root feature-catalog.json. This file imports the
 * committed copy at src/lib/feature-catalog.json so a Railway frontend/
 * root still builds. prebuild copies from the repo root when it exists.
 */
import catalogJson from "./feature-catalog.json";
import type { AppRole } from "./types";

export type FeatureReadiness = "ready" | "staging" | "unverified_api";

export type FeatureId = keyof typeof catalogJson;

export interface FeatureDef {
  id: FeatureId;
  title: string;
  readiness: FeatureReadiness;
  hideFromOpsOnly: boolean;
  reason: string;
}

export const FEATURES = catalogJson as Record<FeatureId, FeatureDef>;

export function isFeatureVisibleToRole(featureId: FeatureId, role: AppRole | null): boolean {
  const feature = FEATURES[featureId];
  if (feature.hideFromOpsOnly && role === "ops_only") return false;
  return true;
}

export function featureBadgeLabel(readiness: FeatureReadiness): string | null {
  if (readiness === "unverified_api") return "Not ready";
  if (readiness === "staging") return "Staging";
  return null;
}

export function isFeatureActionEnabled(featureId: FeatureId): boolean {
  return FEATURES[featureId].readiness === "ready";
}
