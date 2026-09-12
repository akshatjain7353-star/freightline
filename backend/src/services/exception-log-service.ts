import { supabase } from "../supabase/client.js";

export async function logException(entry: {
  source: "booking" | "tracking_poll";
  shipmentId?: string | null;
  carrierId?: string | null;
  errorMessage: string;
  rawContext?: unknown;
}) {
  const { error } = await supabase.from("exception_log").insert({
    source: entry.source,
    shipment_id: entry.shipmentId ?? null,
    carrier_id: entry.carrierId ?? null,
    error_message: entry.errorMessage,
    raw_context: entry.rawContext ?? null,
  });
  // Exception logging must never break the caller — log and move on.
  if (error) console.error("Failed to write exception log:", error);
}
