import { supabase } from "../supabase/client.js";
import type { PaymentMode, ZoneCode } from "../lib/types.js";

export type SlabKey =
  | "flat_0_250"
  | "flat_upto_500"
  | "flat_upto_5000"
  | "flat_upto_10000"
  | "additional_500g_500_to_5000"
  | "additional_1kg_5000_to_10000"
  | "additional_1kg_beyond_10000";

type SlabPrices = Record<SlabKey, number>;

async function loadSlabPrices(rateCardId: string, zoneCode: ZoneCode): Promise<SlabPrices> {
  const { data, error } = await supabase
    .from("rate_card_slab_prices")
    .select("slab_key, price_rupees")
    .eq("rate_card_id", rateCardId)
    .eq("zone_code", zoneCode);

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(`No rate card prices found for rate_card_id=${rateCardId} zone=${zoneCode}`);
  }

  const prices = {} as SlabPrices;
  for (const row of data) {
    prices[row.slab_key as SlabKey] = Number(row.price_rupees);
  }
  return prices;
}

/**
 * Round-up-to-slab fallback pricing, per the exact bands specified for
 * Delhivery's rate card. Used when the live rate API is unavailable, or for
 * offline estimation.
 */
export function calculateSlabPriceRupees(chargeableWeightGrams: number, prices: SlabPrices): number {
  if (chargeableWeightGrams <= 250) {
    return prices.flat_0_250;
  }
  if (chargeableWeightGrams <= 500) {
    return prices.flat_upto_500;
  }
  if (chargeableWeightGrams <= 5000) {
    const roundedGrams = Math.ceil(chargeableWeightGrams / 500) * 500;
    const incrementsAbove500 = (roundedGrams - 500) / 500;
    return prices.flat_upto_500 + incrementsAbove500 * prices.additional_500g_500_to_5000;
  }
  if (chargeableWeightGrams <= 10000) {
    const roundedGrams = Math.ceil(chargeableWeightGrams / 1000) * 1000;
    const kgAbove5 = (roundedGrams - 5000) / 1000;
    return prices.flat_upto_5000 + kgAbove5 * prices.additional_1kg_5000_to_10000;
  }
  const roundedGrams = Math.ceil(chargeableWeightGrams / 1000) * 1000;
  const kgAbove10 = (roundedGrams - 10000) / 1000;
  return prices.flat_upto_10000 + kgAbove10 * prices.additional_1kg_beyond_10000;
}

/** COD charge = 1% of shipment value or ₹20, whichever is higher. */
export function calculateCodChargeRupees(shipmentValueRupees: number): number {
  return Math.max(shipmentValueRupees * 0.01, 20);
}

export interface FallbackRateResult {
  baseCostRupees: number;
  codChargeRupees: number;
  fuelSurchargePercentApplied: number;
  totalCostRupees: number;
}

/**
 * Full fallback quote: slab price -> fuel surcharge -> COD charge. RTO uses
 * the same rate card as forward per spec, so this is also used for RTO
 * pricing by passing paymentMode as needed.
 */
export async function calculateFallbackRate(params: {
  rateCardId: string;
  zoneCode: ZoneCode;
  chargeableWeightGrams: number;
  paymentMode: PaymentMode;
  shipmentValueRupees: number;
  fuelSurchargePercent: number;
}): Promise<FallbackRateResult> {
  const prices = await loadSlabPrices(params.rateCardId, params.zoneCode);
  const baseCostRupees = calculateSlabPriceRupees(params.chargeableWeightGrams, prices);
  const withFuelSurcharge = baseCostRupees * (1 + params.fuelSurchargePercent / 100);
  const codChargeRupees = params.paymentMode === "COD" ? calculateCodChargeRupees(params.shipmentValueRupees) : 0;

  return {
    baseCostRupees: withFuelSurcharge,
    codChargeRupees,
    fuelSurchargePercentApplied: params.fuelSurchargePercent,
    totalCostRupees: withFuelSurcharge + codChargeRupees,
  };
}
