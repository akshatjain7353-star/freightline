import { FEATURES, type FeatureId } from "../../lib/feature-flags";

export function ComingSoon({ feature }: { feature: FeatureId }) {
  const def = FEATURES[feature];

  return (
    <div className="max-w-xl mx-auto mt-8 bg-surface border border-border rounded p-6">
      <div className="text-xs uppercase tracking-wide text-warning mb-2">
        {def.readiness === "unverified_api" ? "Coming soon" : "Staging"}
      </div>
      <h2 className="text-sm font-semibold text-primary mb-2">{def.title}</h2>
      <p className="text-sm text-secondary">{def.reason}</p>
      <p className="text-xs text-muted mt-3">This screen is hidden for operations-only users until it is verified.</p>
    </div>
  );
}
