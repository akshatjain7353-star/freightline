import { FEATURES, type FeatureId } from "../../lib/feature-flags";

export function StagingBanner({ feature }: { feature: FeatureId }) {
  const def = FEATURES[feature];
  const label = def.readiness === "unverified_api" ? "Not ready" : "Staging";

  return (
    <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded px-3 py-2 mb-4">
      <span className="font-medium uppercase tracking-wide mr-2">{label}</span>
      {def.reason}
    </div>
  );
}
