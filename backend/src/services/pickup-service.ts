import { supabase } from "../supabase/client.js";
import { getCarrierAdapter } from "../adapters/registry.js";
import { writeAuditLog } from "./audit-log-service.js";
import type { Dimensions } from "../lib/types.js";

export class ShipmentNotFoundError extends Error {
  constructor(id: string) {
    super(`Shipment ${id} not found`);
    this.name = "ShipmentNotFoundError";
  }
}

async function loadShipmentWithCarrier(shipmentId: string) {
  const { data, error } = await supabase
    .from("shipments")
    .select("*, carriers(code)")
    .eq("id", shipmentId)
    .single();
  if (error || !data) throw new ShipmentNotFoundError(shipmentId);
  return data as typeof data & { carriers: { code: string } };
}

export async function schedulePickup(shipmentId: string, pickupDate: string, actorId: string | null | undefined) {
  const shipment = await loadShipmentWithCarrier(shipmentId);
  if (!shipment.awb) throw new Error("Shipment has no AWB yet — book it before scheduling a pickup.");

  const adapter = getCarrierAdapter(shipment.carriers.code);
  const result = await adapter.schedulePickup({
    awb: shipment.awb,
    pickupDate,
    pickupPincode: shipment.origin_pincode,
  });

  const { data: pickupRow, error } = await supabase
    .from("pickup_request")
    .insert({
      shipment_id: shipmentId,
      direction: "forward",
      carrier_id: shipment.carrier_id,
      pickup_date: pickupDate,
      status: "scheduled",
      carrier_pickup_id: result.carrierPickupId ?? null,
      raw_response: result.raw,
      requested_by: actorId ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  await writeAuditLog({
    actorId,
    action: "pickup.scheduled",
    entityType: "shipment",
    entityId: shipmentId,
    after: { pickup_request_id: pickupRow.id, pickup_date: pickupDate },
  });

  return pickupRow;
}

export async function generateLabel(shipmentId: string) {
  const shipment = await loadShipmentWithCarrier(shipmentId);
  if (!shipment.awb) throw new Error("Shipment has no AWB yet — book it before generating a label.");

  const adapter = getCarrierAdapter(shipment.carriers.code);
  return adapter.generateLabel(shipment.awb);
}

export interface BookReversePickupParams {
  orderId: string;
  clientId: string;
  clientName: string;
  carrierCode: string;
  /** Where the carrier collects the item from — the customer's address. */
  pickupAddressLine: string;
  pickupCity: string;
  pickupPincode: string;
  /** Where the item is being returned to — the vendor/origin. */
  destinationPincode: string;
  weightGrams: number;
  dimensions: Dimensions;
  shipmentValueRupees: number;
  pickupDate: string;
  /** Set when this reverse pickup is linked back to a prior forward shipment. */
  relatedShipmentId: string | null;
}

/**
 * Books a reverse pickup as a brand-new shipment (own AWB) rather than
 * flipping an existing row's status, per the confirmed design decision —
 * this mirrors how a vendor actually books a reverse pickup as a distinct
 * manifest entry. Shared by the shipment-linked flow (scheduleReversePickup),
 * the standalone flow (createStandaloneReversePickup), and approving a
 * client-submitted DTO request (dto-request-service.ts).
 */
export async function bookReversePickup(params: BookReversePickupParams, actorId: string | null | undefined) {
  const adapter = getCarrierAdapter(params.carrierCode);

  const { data: carrier, error: carrierError } = await supabase
    .from("carriers")
    .select("id")
    .eq("code", params.carrierCode)
    .single();
  if (carrierError || !carrier) throw new Error(`Carrier ${params.carrierCode} not found in carriers table`);

  const quote = await adapter.getRateQuote({
    originPincode: params.pickupPincode,
    destinationPincode: params.destinationPincode,
    weightGrams: params.weightGrams,
    dimensions: params.dimensions,
    paymentMode: "Prepaid",
    shipmentValueRupees: params.shipmentValueRupees,
  });

  const booking = await adapter.scheduleReversePickup({
    orderId: params.orderId,
    clientName: params.clientName,
    addressLine: params.pickupAddressLine,
    city: params.pickupCity,
    pickupPincode: params.pickupPincode,
    destinationPincode: params.destinationPincode,
    weightGrams: params.weightGrams,
    dimensions: params.dimensions,
    shipmentValueRupees: params.shipmentValueRupees,
    pickupDate: params.pickupDate,
  });

  const { data: dtoShipment, error: insertError } = await supabase
    .from("shipments")
    .insert({
      awb: booking.awb,
      order_id: params.orderId,
      client_id: params.clientId,
      carrier_id: carrier.id,
      origin_pincode: params.pickupPincode,
      destination_pincode: params.destinationPincode,
      weight_grams: params.weightGrams,
      length_cm: params.dimensions.lengthCm,
      width_cm: params.dimensions.widthCm,
      height_cm: params.dimensions.heightCm,
      chargeable_weight_grams: quote.chargeableWeightGrams,
      zone_code: quote.zone.zoneCode,
      zone_source: quote.zone.source,
      payment_mode: "Prepaid",
      status: "dto",
      rate_card_id: quote.rateCardId,
      cost_rupees: quote.totalCostRupees,
      cod_charge_rupees: 0,
      fuel_surcharge_percent_applied: quote.fuelSurchargePercentApplied,
      shipment_value_rupees: params.shipmentValueRupees,
      raw_booking_response: booking.raw,
      related_shipment_id: params.relatedShipmentId,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  const { data: pickupRow, error: pickupError } = await supabase
    .from("pickup_request")
    .insert({
      shipment_id: dtoShipment.id,
      direction: "reverse",
      carrier_id: carrier.id,
      pickup_date: params.pickupDate,
      status: "scheduled",
      raw_response: booking.raw,
      requested_by: actorId ?? null,
    })
    .select()
    .single();
  if (pickupError) throw pickupError;

  await writeAuditLog({
    actorId,
    action: "dto.initiated",
    entityType: "shipment",
    entityId: params.relatedShipmentId ?? dtoShipment.id,
    after: { dto_shipment_id: dtoShipment.id, awb: booking.awb },
  });

  return { shipment: dtoShipment, pickupRequest: pickupRow };
}

/**
 * DTO linked back to an existing forward shipment (the original path this
 * feature shipped with) — loads that shipment's client/address and delegates
 * to bookReversePickup.
 */
export async function scheduleReversePickup(
  originalShipmentId: string,
  pickupDate: string,
  actorId: string | null | undefined,
) {
  const original = await loadShipmentWithCarrier(originalShipmentId);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("name")
    .eq("id", original.client_id)
    .single();
  if (clientError || !client) throw new Error(`Client for shipment ${originalShipmentId} not found`);

  return bookReversePickup(
    {
      orderId: `${original.order_id}-DTO`,
      clientId: original.client_id,
      clientName: client.name,
      carrierCode: original.carriers.code,
      pickupAddressLine: original.destination_address_line ?? "",
      pickupCity: original.destination_city ?? "",
      pickupPincode: original.destination_pincode,
      destinationPincode: original.origin_pincode,
      weightGrams: original.weight_grams,
      dimensions: { lengthCm: original.length_cm, widthCm: original.width_cm, heightCm: original.height_cm },
      shipmentValueRupees: original.shipment_value_rupees ?? 0,
      pickupDate,
      relatedShipmentId: original.id,
    },
    actorId,
  );
}

export interface StandaloneReversePickupInput {
  orderId: string;
  clientId: string;
  clientName: string;
  carrierCode: string;
  pickupAddressLine: string;
  pickupCity: string;
  pickupPincode: string;
  destinationPincode: string;
  weightGrams: number;
  dimensions: Dimensions;
  shipmentValueRupees: number;
  pickupDate: string;
}

/**
 * A reverse pickup with no prior Time Bound shipment at all — e.g. ops
 * booking a customer return that was never shipped by Time Bound outbound.
 */
export async function createStandaloneReversePickup(
  input: StandaloneReversePickupInput,
  actorId: string | null | undefined,
) {
  return bookReversePickup({ ...input, relatedShipmentId: null }, actorId);
}
