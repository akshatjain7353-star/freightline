/**
 * Single source of truth for which surfaces are daily-ops ready vs staged.
 *
 * "ready"          — Phase 1 golden path (or a later slice that is locally complete).
 * "staging"        — UI/schema exists; not safe to treat as production (GST, matching assumptions).
 * "unverified_api" — calls a Delhivery (or other) contract that has not been confirmed in sandbox.
 *
 * Keep this catalog in sync with frontend/src/lib/feature-flags.ts.
 */

export type FeatureReadiness = "ready" | "staging" | "unverified_api";

export type FeatureId =
  | "dashboard"
  | "shipments"
  | "createShipment"
  | "rateCalculator"
  | "bulkUpload"
  | "exceptions"
  | "rateCards"
  | "clientRateCards"
  | "clientApiKeys"
  | "weightDiscrepancies"
  | "ndrQueue"
  | "pickup"
  | "label"
  | "ndrReattempt"
  | "reversePickup"
  | "dtoRequests"
  | "invoices"
  | "vendorReconciliation"
  | "cashReconciliation"
  | "carrierRemittance"
  | "clientLedger"
  | "unicommerce";

export interface FeatureDef {
  id: FeatureId;
  title: string;
  readiness: FeatureReadiness;
  /** Hide from the ops_only sidebar and show Coming soon on direct URL. */
  hideFromOpsOnly: boolean;
  reason: string;
}

export const FEATURES: Record<FeatureId, FeatureDef> = {
  dashboard: {
    id: "dashboard",
    title: "Dashboard",
    readiness: "ready",
    hideFromOpsOnly: false,
    reason: "KPIs and charts read seeded/live shipments.",
  },
  shipments: {
    id: "shipments",
    title: "Shipments",
    readiness: "ready",
    hideFromOpsOnly: false,
    reason: "List/detail status from shipments_ops_view.",
  },
  createShipment: {
    id: "createShipment",
    title: "Create Shipment",
    readiness: "ready",
    hideFromOpsOnly: false,
    reason: "Forward booking via documented Delhivery manifest, or local save if no API key.",
  },
  rateCalculator: {
    id: "rateCalculator",
    title: "Rate Calculator",
    readiness: "ready",
    hideFromOpsOnly: false,
    reason: "Live Delhivery quote with rate-card fallback.",
  },
  bulkUpload: {
    id: "bulkUpload",
    title: "Bulk Upload",
    readiness: "ready",
    hideFromOpsOnly: false,
    reason: "CSV → same booking path as Create Shipment.",
  },
  exceptions: {
    id: "exceptions",
    title: "Exceptions",
    readiness: "ready",
    hideFromOpsOnly: false,
    reason: "Local exception_log queue.",
  },
  rateCards: {
    id: "rateCards",
    title: "Rate Cards",
    readiness: "ready",
    hideFromOpsOnly: false,
    reason: "Vendor rate-card versioning is local and audited.",
  },
  clientRateCards: {
    id: "clientRateCards",
    title: "Client Rate Cards",
    readiness: "ready",
    hideFromOpsOnly: false,
    reason: "Sell-side slabs are local; a client with no card books with null billed amount.",
  },
  clientApiKeys: {
    id: "clientApiKeys",
    title: "API Keys",
    readiness: "ready",
    hideFromOpsOnly: false,
    reason: "Local key issue/revoke. External DTO intake still depends on reverse-pickup readiness.",
  },
  weightDiscrepancies: {
    id: "weightDiscrepancies",
    title: "Weight Discrepancies",
    readiness: "ready",
    hideFromOpsOnly: false,
    reason: "Manual vendor-weight PATCH + Accept/Dispute/Resolve work. Auto flags from tracking ChargedWeight are unverified.",
  },
  ndrQueue: {
    id: "ndrQueue",
    title: "NDR Queue",
    readiness: "staging",
    hideFromOpsOnly: true,
    reason: "Local address / contact / convert-to-RTO work. Carrier reattempt is unverified.",
  },
  pickup: {
    id: "pickup",
    title: "Schedule Pickup",
    readiness: "unverified_api",
    hideFromOpsOnly: true,
    reason: "Delhivery pickup path, params, and response shape are unconfirmed against sandbox.",
  },
  label: {
    id: "label",
    title: "Shipping Label",
    readiness: "unverified_api",
    hideFromOpsOnly: true,
    reason: "Delhivery packing-slip path and PDF URL field are unconfirmed against sandbox.",
  },
  ndrReattempt: {
    id: "ndrReattempt",
    title: "NDR Reattempt",
    readiness: "unverified_api",
    hideFromOpsOnly: true,
    reason: "Delhivery NDR reattempt path and request shape are unconfirmed against sandbox.",
  },
  reversePickup: {
    id: "reversePickup",
    title: "Create Reverse Pickup",
    readiness: "unverified_api",
    hideFromOpsOnly: true,
    reason: "Reverse-pickup flag/field names on the manifest endpoint are unconfirmed.",
  },
  dtoRequests: {
    id: "dtoRequests",
    title: "DTO Requests",
    readiness: "unverified_api",
    hideFromOpsOnly: true,
    reason: "Approve books a reverse pickup through the same unverified adapter.",
  },
  invoices: {
    id: "invoices",
    title: "Invoices",
    readiness: "staging",
    hideFromOpsOnly: true,
    reason: "GST rate is hardcoded 18% and every line is IGST. Do not file or send to clients.",
  },
  vendorReconciliation: {
    id: "vendorReconciliation",
    title: "Vendor Reconciliation",
    readiness: "staging",
    hideFromOpsOnly: true,
    reason: "AWB-only one-to-one matching. Review before treating discrepancies as final.",
  },
  cashReconciliation: {
    id: "cashReconciliation",
    title: "Cash Reconciliation",
    readiness: "staging",
    hideFromOpsOnly: true,
    reason: "Local COD status + billed amounts. Depends on client rate cards being published.",
  },
  carrierRemittance: {
    id: "carrierRemittance",
    title: "Carrier COD Remittance",
    readiness: "staging",
    hideFromOpsOnly: true,
    reason: "Assumes one remittance line per AWB. Real Delhivery reports may batch or split.",
  },
  clientLedger: {
    id: "clientLedger",
    title: "Client Ledger",
    readiness: "staging",
    hideFromOpsOnly: true,
    reason: "Settlement period uses ledger-entry created_at, not shipment/delivery date.",
  },
  unicommerce: {
    id: "unicommerce",
    title: "Unicommerce Credentials",
    readiness: "staging",
    hideFromOpsOnly: true,
    reason: "Credential issue works locally; shipper surface is incomplete (manifest not implemented).",
  },
};

export const UNVERIFIED_API_FEATURES: FeatureId[] = (
  Object.values(FEATURES) as FeatureDef[]
)
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
