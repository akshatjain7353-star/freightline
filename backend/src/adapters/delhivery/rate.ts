import { delhiveryHttp } from "./client.js";
import { resolveZone } from "../../rate-engine/zone-resolver.js";
import { calculateChargeableWeightGrams } from "../../rate-engine/chargeable-weight.js";
import { calculateFallbackRate, calculateCodChargeRupees } from "../../rate-engine/rate-card-calculator.js";
import { getCurrentRateCard } from "../../rate-engine/current-rate-card.js";
import { isDelhiveryConfigured } from "../../config/env.js";
import type { Dimensions, PaymentMode, RateQuote } from "../../lib/types.js";

interface GetRateQuoteParams {
  originPincode: string;
  destinationPincode: string;
  weightGrams: number;
  dimensions: Dimensions;
  paymentMode: PaymentMode;
  shipmentValueRupees: number;
  rateType?: "forward" | "dto";
  /** Force the manual rate-card fallback instead of calling the live API (offline estimation). */
  forceFallback?: boolean;
}

/**
 * Primary quote source: GET /api/kinko/v1/invoice/charges/.json
 *
 * Note on the "ss" (shipment status) param this endpoint also accepts: its
 * purpose for a *pre-shipment* quote (as opposed to an existing shipment) is
 * undocumented. It is deliberately omitted here rather than guessed at — do
 * not add it without first confirming its behavior against the Delhivery
 * sandbox and documenting what it actually does.
 */
async function fetchLiveQuote(params: {
  chargeableWeightGrams: number;
  originPincode: string;
  destinationPincode: string;
  paymentMode: PaymentMode;
  dimensions: Dimensions;
}): Promise<number> {
  const response = await delhiveryHttp.get("/api/kinko/v1/invoice/charges/.json", {
    params: {
      md: "E", // Express. Surface ("S") is not exposed in the UI this phase.
      cgm: Math.round(params.chargeableWeightGrams),
      o_pin: params.originPincode,
      d_pin: params.destinationPincode,
      pt: params.paymentMode,
      l: params.dimensions.lengthCm,
      b: params.dimensions.widthCm,
      h: params.dimensions.heightCm,
    },
  });

  // Delhivery's documented response is an array with a `total_amount` field
  // on the first element for this endpoint.
  const charge = Array.isArray(response.data) ? response.data[0] : response.data;
  const totalAmount = charge?.total_amount ?? charge?.charge_DLV;
  if (typeof totalAmount !== "number") {
    throw new Error(`Unexpected Delhivery rate API response shape: ${JSON.stringify(response.data)}`);
  }
  return totalAmount;
}

export async function getRateQuote(params: GetRateQuoteParams): Promise<RateQuote> {
  const chargeableWeightGrams = calculateChargeableWeightGrams(params.weightGrams, params.dimensions);
  const zone = await resolveZone(params.originPincode, params.destinationPincode);
  const currentRateCard = await getCurrentRateCard("delhivery");
  const rateType = params.rateType ?? "forward";

  // Delhivery's live rate API has no concept of a DTO/reverse-pickup quote -
  // calling it for a DTO would just return a forward-priced quote for
  // whichever pincodes are passed, mislabeled as a DTO rate. DTO always uses
  // our own separately-negotiated slab table below instead.
  const skipLiveApi = params.forceFallback || rateType === "dto" || !isDelhiveryConfigured();

  if (!skipLiveApi) {
    try {
      const totalAmount = await fetchLiveQuote({
        chargeableWeightGrams,
        originPincode: params.originPincode,
        destinationPincode: params.destinationPincode,
        paymentMode: params.paymentMode,
        dimensions: params.dimensions,
      });
      const codChargeRupees =
        params.paymentMode === "COD"
          ? calculateCodChargeRupees(
              params.shipmentValueRupees,
              currentRateCard.codChargePercent,
              currentRateCard.codChargeMinimumRupees,
            )
          : 0;

      return {
        carrierCode: "delhivery",
        carrierName: "Delhivery",
        zone,
        chargeableWeightGrams,
        baseCostRupees: totalAmount,
        codChargeRupees,
        fuelSurchargePercentApplied: 0, // live API charges already include any applicable surcharge
        totalCostRupees: totalAmount + codChargeRupees,
        source: "carrier_api",
        rateCardId: currentRateCard.id,
      };
    } catch (err) {
      // Fall through to the manual rate-card calculation below. Network
      // errors and non-2xx responses both land here.
      console.warn("Delhivery live rate API unavailable, using fallback rate card:", (err as Error).message);
    }
  }

  // Fuel surcharge and COD charge come from the current rate card row itself
  // (editable via the rate-card admin routes/versioning flow), not static
  // env defaults — that way "change the surcharge" means "publish a new
  // rate card version" and the change is captured in the same audited
  // history as slab prices.
  const fallback = await calculateFallbackRate({
    rateCardId: currentRateCard.id,
    zoneCode: zone.zoneCode,
    chargeableWeightGrams,
    paymentMode: params.paymentMode,
    shipmentValueRupees: params.shipmentValueRupees,
    fuelSurchargePercent: currentRateCard.fuelSurchargePercent,
    codChargePercent: currentRateCard.codChargePercent,
    codChargeMinimumRupees: currentRateCard.codChargeMinimumRupees,
    rateType,
  });

  return {
    carrierCode: "delhivery",
    carrierName: "Delhivery",
    zone,
    chargeableWeightGrams,
    baseCostRupees: fallback.baseCostRupees,
    codChargeRupees: fallback.codChargeRupees,
    fuelSurchargePercentApplied: fallback.fuelSurchargePercentApplied,
    totalCostRupees: fallback.totalCostRupees,
    source: "fallback_rate_card",
    rateCardId: currentRateCard.id,
  };
}
