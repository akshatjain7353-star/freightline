import { supabase } from "../supabase/client.js";
import { getCarrierAdapter } from "../adapters/registry.js";
import { env } from "../config/env.js";
import type { TrackingUpdate } from "../lib/types.js";

// Delhivery's tracking API is documented as poll-only — no webhook support is
// assumed. This runs on a configurable interval instead of reacting to push
// events.
const ACTIVE_STATUSES = ["pending", "in_transit", "ndr"] as const;

function mapCarrierStatus(rawStatus: string): "pending" | "in_transit" | "delivered" | "ndr" | "rto" {
  const normalized = rawStatus.toLowerCase();
  if (normalized.includes("deliver")) return "delivered";
  if (normalized.includes("rto") || normalized.includes("return")) return "rto";
  if (normalized.includes("ndr") || normalized.includes("undelivered") || normalized.includes("failed")) return "ndr";
  if (normalized.includes("transit") || normalized.includes("dispatch") || normalized.includes("pickup")) {
    return "in_transit";
  }
  return "pending";
}

async function pollCarrier(carrierCode: string, carrierId: string) {
  const { data: shipments, error } = await supabase
    .from("shipments")
    .select("id, awb")
    .eq("carrier_id", carrierId)
    .in("status", ACTIVE_STATUSES)
    .not("awb", "is", null);

  if (error) {
    console.error(`[tracking-poller] failed to load ${carrierCode} shipments:`, error.message);
    return;
  }
  if (!shipments || shipments.length === 0) return;

  const awbToShipmentId = new Map(shipments.map((s) => [s.awb as string, s.id as string]));
  const adapter = getCarrierAdapter(carrierCode);

  let updates: TrackingUpdate[];
  try {
    updates = await adapter.trackShipments(Array.from(awbToShipmentId.keys()));
  } catch (err) {
    console.error(`[tracking-poller] ${carrierCode} tracking call failed:`, (err as Error).message);
    return;
  }

  for (const update of updates) {
    const shipmentId = awbToShipmentId.get(update.awb);
    if (!shipmentId) continue;

    const mappedStatus = mapCarrierStatus(update.status);

    await supabase.from("tracking_events").insert({
      shipment_id: shipmentId,
      status: update.status,
      event_timestamp: update.eventTimestamp,
      location: update.location,
      raw_carrier_payload: update.raw,
    });

    await supabase.from("shipments").update({ status: mappedStatus }).eq("id", shipmentId);
  }
}

export async function runTrackingPollOnce() {
  const { data: carriers, error } = await supabase.from("carriers").select("id, code").eq("active", true);
  if (error) {
    console.error("[tracking-poller] failed to load carriers:", error.message);
    return;
  }

  for (const carrier of carriers ?? []) {
    try {
      await pollCarrier(carrier.code, carrier.id);
    } catch (err) {
      console.error(`[tracking-poller] error polling ${carrier.code}:`, (err as Error).message);
    }
  }
}

export function startTrackingPoller() {
  const intervalMs = env.TRACKING_POLL_INTERVAL_MINUTES * 60 * 1000;
  console.log(`[tracking-poller] starting, interval=${env.TRACKING_POLL_INTERVAL_MINUTES}min`);

  // Fire once at startup, then on the configured interval.
  void runTrackingPollOnce();
  setInterval(() => {
    void runTrackingPollOnce();
  }, intervalMs);
}
