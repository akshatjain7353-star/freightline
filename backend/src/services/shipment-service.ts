import { supabase } from "../supabase/client.js";
import { getCarrierAdapter } from "../adapters/registry.js";
import type { Dimensions, PaymentMode } from "../lib/types.js";

export interface CreateShipmentInput {
  orderId: string;
  clientId: string;
  clientName: string;
  addressLine: string;
  city: string;
  carrierCode: string;
  originPincode: string;
  destinationPincode: string;
  weightGrams: number;
  dimensions: Dimensions;
  paymentMode: PaymentMode;
  shipmentValueRupees: number;
}

export class NonServiceableError extends Error {
  constructor(public readonly pincode: string) {
    super(`Destination pincode ${pincode} is not serviceable (NSZ).`);
    this.name = "NonServiceableError";
  }
}

/**
 * Shared path used by both the single-shipment create route and bulk upload:
 * serviceability check -> rate/zone resolution -> carrier booking -> DB insert.
 */
export async function bookAndCreateShipment(input: CreateShipmentInput) {
  const adapter = getCarrierAdapter(input.carrierCode);

  const serviceability = await adapter.checkServiceability(input.destinationPincode);
  if (!serviceability.serviceable) {
    throw new NonServiceableError(input.destinationPincode);
  }

  const quote = await adapter.getRateQuote(input);

  const booking = await adapter.createShipment({
    orderId: input.orderId,
    clientName: input.clientName,
    addressLine: input.addressLine,
    city: input.city,
    originPincode: input.originPincode,
    destinationPincode: input.destinationPincode,
    weightGrams: input.weightGrams,
    dimensions: input.dimensions,
    paymentMode: input.paymentMode,
    shipmentValueRupees: input.shipmentValueRupees,
  });

  const { data: carrier, error: carrierError } = await supabase
    .from("carriers")
    .select("id")
    .eq("code", input.carrierCode)
    .single();
  if (carrierError || !carrier) {
    throw new Error(`Carrier ${input.carrierCode} not found in carriers table`);
  }

  const { data: shipment, error: insertError } = await supabase
    .from("shipments")
    .insert({
      awb: booking.awb,
      order_id: input.orderId,
      client_id: input.clientId,
      carrier_id: carrier.id,
      origin_pincode: input.originPincode,
      destination_pincode: input.destinationPincode,
      weight_grams: input.weightGrams,
      length_cm: input.dimensions.lengthCm,
      width_cm: input.dimensions.widthCm,
      height_cm: input.dimensions.heightCm,
      chargeable_weight_grams: quote.chargeableWeightGrams,
      zone_code: quote.zone.zoneCode,
      zone_source: quote.zone.source,
      payment_mode: input.paymentMode,
      status: "pending",
      cost_rupees: quote.totalCostRupees,
      cod_charge_rupees: quote.codChargeRupees,
      fuel_surcharge_percent_applied: quote.fuelSurchargePercentApplied,
      shipment_value_rupees: input.shipmentValueRupees,
      raw_booking_response: booking.raw,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return { shipment, quote };
}
