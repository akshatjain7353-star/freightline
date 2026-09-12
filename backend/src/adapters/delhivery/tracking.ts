import { delhiveryHttp } from "./client.js";
import type { TrackingUpdate } from "../../lib/types.js";

const MAX_WAYBILLS_PER_CALL = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * GET /api/v1/packages/json/?waybill=<awb1,awb2,...>
 * Supports up to 50 comma-separated waybills per call. No webhook support is
 * assumed — this is polled on an interval by jobs/tracking-poller.ts.
 */
export async function trackShipments(awbs: string[]): Promise<TrackingUpdate[]> {
  const updates: TrackingUpdate[] = [];

  for (const batch of chunk(awbs, MAX_WAYBILLS_PER_CALL)) {
    const response = await delhiveryHttp.get("/api/v1/packages/json/", {
      params: { waybill: batch.join(",") },
    });

    const shipmentData = response.data?.ShipmentData ?? [];
    for (const entry of shipmentData) {
      const shipment = entry?.Shipment;
      if (!shipment) continue;

      const scans = shipment.Scans ?? [];
      const latestScan = scans[scans.length - 1]?.ScanDetail;

      // Field name is unconfirmed against real Delhivery tracking payloads —
      // same caution the codebase already applies to the zone-classification
      // API and the rate API's `ss` param. Verify against sandbox before
      // relying on this for real weight-discrepancy flags.
      const chargedWeight = shipment.ChargedWeight ?? shipment.charged_weight;

      updates.push({
        awb: shipment.AWB,
        status: latestScan?.Status ?? shipment.Status?.Status ?? "unknown",
        eventTimestamp: latestScan?.ScanDateTime ?? shipment.Status?.StatusDateTime ?? new Date().toISOString(),
        location: latestScan?.ScannedLocation,
        vendorChargedWeightGrams: typeof chargedWeight === "number" ? chargedWeight : undefined,
        raw: entry,
      });
    }
  }

  return updates;
}
