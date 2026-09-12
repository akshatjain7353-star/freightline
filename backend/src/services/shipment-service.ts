import { supabase } from "../supabase/client.js";
import { getCarrierAdapter } from "../adapters/registry.js";
import { logException } from "./exception-log-service.js";
import { PincodeNotMappedError } from "../rate-engine/zone-resolver.js";
import { calculateClientBilledAmount } from "../rate-engine/client-rate-engine.js";
import type { Dimensions, PaymentMode } from "../lib/types.js";

export type ShipmentSource = "manual" | "bulk_upload" | "unicommerce";

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
  source?: ShipmentSource;
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
  try {
    return await doBookAndCreateShipment(input);
  } catch (err) {
    // NonServiceableError/PincodeNotMappedError are expected validation
    // failures already surfaced to the caller by the route handlers — only
    // log genuinely unexpected failures (carrier API errors, DB errors) to
    // the exceptions queue.
    if (!(err instanceof NonServiceableError) && !(err instanceof PincodeNotMappedError)) {
      await logException({
        source: "booking",
        errorMessage: (err as Error).message,
        rawContext: { orderId: input.orderId, carrierCode: input.carrierCode },
      });
    }
    throw err;
  }
}

async function doBookAndCreateShipment(input: CreateShipmentInput) {
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

  // Sell-side pricing (client_billed_amount) is independent of the vendor
  // quote above — null until the client has their own rate card, rather
  // than falling back to a guessed number.
  const clientBill = await calculateClientBilledAmount({
    clientId: input.clientId,
    zoneCode: quote.zone.zoneCode,
    chargeableWeightGrams: quote.chargeableWeightGrams,
    paymentMode: input.paymentMode,
    shipmentValueRupees: input.shipmentValueRupees,
  });

  const { data: shipment, error: insertError } = await supabase
    .from("shipments")
    .insert({
      awb: booking.awb,
      order_id: input.orderId,
      client_id: input.clientId,
      carrier_id: carrier.id,
      origin_pincode: input.originPincode,
      destination_pincode: input.destinationPincode,
      destination_address_line: input.addressLine,
      destination_city: input.city,
      weight_grams: input.weightGrams,
      length_cm: input.dimensions.lengthCm,
      width_cm: input.dimensions.widthCm,
      height_cm: input.dimensions.heightCm,
      chargeable_weight_grams: quote.chargeableWeightGrams,
      zone_code: quote.zone.zoneCode,
      zone_source: quote.zone.source,
      payment_mode: input.paymentMode,
      status: "pending",
      source: input.source ?? "manual",
      rate_card_id: quote.rateCardId,
      cost_rupees: quote.totalCostRupees,
      cod_charge_rupees: quote.codChargeRupees,
      fuel_surcharge_percent_applied: quote.fuelSurchargePercentApplied,
      shipment_value_rupees: input.shipmentValueRupees,
      raw_booking_response: booking.raw,
      client_rate_card_id: clientBill?.clientRateCardId ?? null,
      client_billed_amount: clientBill?.clientBilledAmountRupees ?? null,
      client_cod_charge_rupees: clientBill?.clientCodChargeRupees ?? 0,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return { shipment, quote };
}
