import type { AppRole } from "./types.js";

/**
 * Strips cost/margin fields from a booking result (shipment row + quote)
 * before it reaches an ops_only caller. Applied server-side — the frontend
 * also avoids rendering these fields, but that's a UI nicety, not the
 * enforcement boundary; the JSON response itself must not carry the numbers.
 */
export function maskCostFieldsForRole<T extends { shipment?: unknown; quote?: unknown }>(
  result: T,
  role: AppRole | null | undefined,
): T {
  if (role !== "ops_only") return result;

  const masked = { ...result } as Record<string, unknown>;
  if (masked.shipment && typeof masked.shipment === "object") {
    masked.shipment = {
      ...(masked.shipment as Record<string, unknown>),
      cost_rupees: null,
      cod_charge_rupees: null,
      client_billed_amount: null,
      client_cod_charge_rupees: null,
    };
  }
  if (masked.quote && typeof masked.quote === "object") {
    const q = { ...(masked.quote as Record<string, unknown>) };
    delete q.baseCostRupees;
    delete q.codChargeRupees;
    delete q.totalCostRupees;
    masked.quote = q;
  }
  return masked as T;
}
