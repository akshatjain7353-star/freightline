/**
 * Keep in sync with backend/src/lib/feature-readiness.ts.
 * Sidebar/route gating uses this static catalog so ops_only never sees
 * unfinished items even if /api/capabilities is unreachable.
 */
import type { AppRole } from "./types";

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
    reason:
      "Manual vendor-weight PATCH + Accept/Dispute/Resolve work. Auto flags from tracking ChargedWeight are unverified.",
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
