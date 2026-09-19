import { supabase } from "../supabase/client.js";
import { getCarrierAdapter } from "../adapters/registry.js";
import { writeAuditLog } from "./audit-log-service.js";
import { assertFeatureReady } from "../lib/feature-readiness.js";

export class ShipmentNotFoundError extends Error {
  constructor(id: string) {
    super(`Shipment ${id} not found`);
    this.name = "ShipmentNotFoundError";
  }
}

export class MaxAttemptsExceededError extends Error {
  constructor(maxAttempts: number) {
    super(`This shipment has already reached its carrier's reattempt limit (${maxAttempts}). Convert to RTO instead.`);
    this.name = "MaxAttemptsExceededError";
  }
}

async function loadNdrShipment(shipmentId: string) {
  const { data, error } = await supabase
    .from("shipments")
    .select("*, carriers(code, max_ndr_attempts)")
    .eq("id", shipmentId)
    .single();
  if (error || !data) throw new ShipmentNotFoundError(shipmentId);
  return data as typeof data & { carriers: { code: string; max_ndr_attempts: number } };
}

async function logNdrAction(
  shipmentId: string,
  action: "reattempt_requested" | "address_edited" | "customer_contacted" | "converted_to_rto",
  performedBy: string | null | undefined,
  attemptNumber: number | null,
  notes: string | null,
) {
  await supabase.from("ndr_action_log").insert({
    shipment_id: shipmentId,
    action,
    performed_by: performedBy ?? null,
    attempt_number: attemptNumber,
    notes,
  });
}

export async function requestReattempt(shipmentId: string, actorId: string | null | undefined) {
  assertFeatureReady("ndrReattempt");
  const shipment = await loadNdrShipment(shipmentId);
  const maxAttempts = shipment.carriers.max_ndr_attempts;
  if (shipment.ndr_attempt_count >= maxAttempts) {
    throw new MaxAttemptsExceededError(maxAttempts);
  }
  if (!shipment.awb) throw new Error("Shipment has no AWB yet.");

  const adapter = getCarrierAdapter(shipment.carriers.code);
  await adapter.requestNdrReattempt(shipment.awb);

  const newAttemptCount = shipment.ndr_attempt_count + 1;
  const { error } = await supabase
    .from("shipments")
    .update({ ndr_attempt_count: newAttemptCount })
    .eq("id", shipmentId);
  if (error) throw error;

  await logNdrAction(shipmentId, "reattempt_requested", actorId, newAttemptCount, null);
  await writeAuditLog({
    actorId,
    action: "ndr.reattempt_requested",
    entityType: "shipment",
    entityId: shipmentId,
    after: { attempt_number: newAttemptCount, max_attempts: maxAttempts },
  });

  return { attemptNumber: newAttemptCount, maxAttempts };
}

export async function editDeliveryAddress(
  shipmentId: string,
  addressLine: string,
  city: string,
  actorId: string | null | undefined,
) {
  const { data: before } = await supabase
    .from("shipments")
    .select("destination_address_line, destination_city")
    .eq("id", shipmentId)
    .maybeSingle();

  const { data: shipment, error } = await supabase
    .from("shipments")
    .update({ destination_address_line: addressLine, destination_city: city })
    .eq("id", shipmentId)
    .select()
    .single();
  if (error || !shipment) throw new ShipmentNotFoundError(shipmentId);

  await logNdrAction(shipmentId, "address_edited", actorId, null, `${addressLine}, ${city}`);
  await writeAuditLog({
    actorId,
    action: "ndr.address_edited",
    entityType: "shipment",
    entityId: shipmentId,
    before,
    after: { destination_address_line: addressLine, destination_city: city },
  });

  return shipment;
}

export async function contactCustomer(shipmentId: string, notes: string, actorId: string | null | undefined) {
  await logNdrAction(shipmentId, "customer_contacted", actorId, null, notes);
  await writeAuditLog({
    actorId,
    action: "ndr.customer_contacted",
    entityType: "shipment",
    entityId: shipmentId,
    after: { notes },
  });
}

export async function convertToRto(shipmentId: string, actorId: string | null | undefined) {
  const { data: shipment, error } = await supabase
    .from("shipments")
    .update({ status: "rto" })
    .eq("id", shipmentId)
    .select()
    .single();
  if (error || !shipment) throw new ShipmentNotFoundError(shipmentId);

  await logNdrAction(shipmentId, "converted_to_rto", actorId, null, null);
  await writeAuditLog({
    actorId,
    action: "ndr.converted_to_rto",
    entityType: "shipment",
    entityId: shipmentId,
    after: { status: "rto" },
  });

  return shipment;
}
