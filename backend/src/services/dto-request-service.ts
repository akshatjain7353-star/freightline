import { supabase } from "../supabase/client.js";
import { bookReversePickup } from "./pickup-service.js";
import { writeAuditLog } from "./audit-log-service.js";
import type { Dimensions } from "../lib/types.js";

export class DtoRequestNotFoundError extends Error {
  constructor(id: string) {
    super(`DTO request ${id} not found`);
    this.name = "DtoRequestNotFoundError";
  }
}

export class DtoRequestNotPendingError extends Error {
  constructor(id: string, status: string) {
    super(`DTO request ${id} is already "${status}", not pending.`);
    this.name = "DtoRequestNotPendingError";
  }
}

export interface SubmitDtoRequestInput {
  externalReference?: string;
  customerName: string;
  customerPhone?: string;
  pickupAddressLine: string;
  pickupCity: string;
  pickupPincode: string;
  destinationPincode: string;
  weightGrams: number;
  dimensions: Dimensions;
  reason?: string;
  carrierCode?: string;
}

export async function submitDtoRequest(clientId: string, input: SubmitDtoRequestInput) {
  // Idempotent on (client_id, external_reference): a retried submission with
  // the same reference returns the existing request instead of duplicating it.
  if (input.externalReference) {
    const { data: existing } = await supabase
      .from("dto_requests")
      .select("id, status")
      .eq("client_id", clientId)
      .eq("external_reference", input.externalReference)
      .maybeSingle();
    if (existing) return existing;
  }

  const { data, error } = await supabase
    .from("dto_requests")
    .insert({
      client_id: clientId,
      external_reference: input.externalReference ?? null,
      customer_name: input.customerName,
      customer_phone: input.customerPhone ?? null,
      pickup_address_line: input.pickupAddressLine,
      pickup_city: input.pickupCity,
      pickup_pincode: input.pickupPincode,
      destination_pincode: input.destinationPincode,
      weight_grams: input.weightGrams,
      length_cm: input.dimensions.lengthCm,
      width_cm: input.dimensions.widthCm,
      height_cm: input.dimensions.heightCm,
      reason: input.reason ?? null,
      carrier_code: input.carrierCode ?? "delhivery",
    })
    .select("id, status")
    .single();
  if (error) throw error;
  return data;
}

export async function getDtoRequest(id: string, clientId?: string) {
  let query = supabase.from("dto_requests").select("*").eq("id", id);
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new DtoRequestNotFoundError(id);
  return data;
}

export async function listPendingDtoRequests() {
  const { data, error } = await supabase
    .from("dto_requests")
    .select("*, clients(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function approveDtoRequest(id: string, pickupDate: string, actorId: string | null | undefined) {
  const request = await getDtoRequest(id);
  if (request.status !== "pending") throw new DtoRequestNotPendingError(id, request.status);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("name")
    .eq("id", request.client_id)
    .single();
  if (clientError || !client) throw new Error(`Client for DTO request ${id} not found`);

  const { shipment, pickupRequest } = await bookReversePickup(
    {
      orderId: `DTO-REQ-${id}`,
      clientId: request.client_id,
      clientName: client.name,
      carrierCode: request.carrier_code,
      pickupAddressLine: request.pickup_address_line,
      pickupCity: request.pickup_city,
      pickupPincode: request.pickup_pincode,
      destinationPincode: request.destination_pincode,
      weightGrams: request.weight_grams,
      dimensions: { lengthCm: request.length_cm, widthCm: request.width_cm, heightCm: request.height_cm },
      shipmentValueRupees: 0,
      pickupDate,
      relatedShipmentId: null,
    },
    actorId,
  );

  const { data: updated, error: updateError } = await supabase
    .from("dto_requests")
    .update({
      status: "booked",
      created_shipment_id: shipment.id,
      reviewed_by: actorId ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (updateError) throw updateError;

  await writeAuditLog({
    actorId,
    action: "dto_request.approved",
    entityType: "dto_request",
    entityId: id,
    after: { shipment_id: shipment.id, awb: shipment.awb },
  });

  return { dtoRequest: updated, shipment, pickupRequest };
}

export async function rejectDtoRequest(id: string, reason: string, actorId: string | null | undefined) {
  const request = await getDtoRequest(id);
  if (request.status !== "pending") throw new DtoRequestNotPendingError(id, request.status);

  const { data: updated, error } = await supabase
    .from("dto_requests")
    .update({
      status: "rejected",
      rejection_reason: reason,
      reviewed_by: actorId ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  await writeAuditLog({
    actorId,
    action: "dto_request.rejected",
    entityType: "dto_request",
    entityId: id,
    after: { reason },
  });

  return updated;
}
