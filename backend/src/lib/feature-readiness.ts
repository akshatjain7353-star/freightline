/**
 * Runtime helpers for the Phase 1 / staging / unverified catalog.
 *
 * Catalog data lives in feature-catalog.json. An identical copy is kept at
 * frontend/src/lib/feature-catalog.json so each Railway service can build
 * from its own tree. `npm test` fails if the two files drift.
 */

import catalogJson from "./feature-catalog.json";

export type FeatureReadiness = "ready" | "staging" | "unverified_api";

export type FeatureId = keyof typeof catalogJson;

export interface FeatureDef {
  id: FeatureId;
  title: string;
  readiness: FeatureReadiness;
  /** Hide from the ops_only sidebar and show Coming soon on direct URL. */
  hideFromOpsOnly: boolean;
  reason: string;
}

export const FEATURES = catalogJson as Record<FeatureId, FeatureDef>;

export const UNVERIFIED_API_FEATURES: FeatureId[] = (Object.values(FEATURES) as FeatureDef[])
  .filter((f) => f.readiness === "unverified_api")
  .map((f) => f.id);

export class FeatureNotReadyError extends Error {
  readonly featureId: FeatureId;
  readonly code = "feature_not_ready" as const;

  constructor(featureId: FeatureId) {
    const feature = FEATURES[featureId];
    super(`${feature.title} is not ready for live use. ${feature.reason}`);
    this.name = "FeatureNotReadyError";
    this.featureId = featureId;
  }
}

/**
 * Flip to true only after the matching Delhivery/GST contract is confirmed
 * in sandbox. Until then, unverified routes throw FeatureNotReadyError.
 * Keeping this as a runtime flag (not a bare `throw` at the top of the
 * function) preserves TypeScript control-flow narrowing in the real body.
 */
export const UNVERIFIED_APIS_ENABLED = false;

export function assertFeatureReady(featureId: FeatureId): void {
  if (!UNVERIFIED_APIS_ENABLED) {
    throw new FeatureNotReadyError(featureId);
  }
}

export function isOpsOnlyHidden(featureId: FeatureId): boolean {
  return FEATURES[featureId].hideFromOpsOnly;
}

export function isFeatureActionEnabled(featureId: FeatureId): boolean {
  return FEATURES[featureId].readiness === "ready";
}

export function featureNotReadyPayload(err: FeatureNotReadyError) {
  return {
    error: err.code,
    feature: err.featureId,
    message: err.message,
  };
}

export function publicFeatureCatalog() {
  return (Object.values(FEATURES) as FeatureDef[]).map((f) => ({
    id: f.id,
    title: f.title,
    readiness: f.readiness,
    hideFromOpsOnly: f.hideFromOpsOnly,
    reason: f.reason,
  }));
}
