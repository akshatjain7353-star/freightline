import { supabase } from "../supabase/client.js";
import { calculateCodChargeRupees, calculateSlabPriceRupees, type SlabKey } from "./rate-card-calculator.js";
import type { PaymentMode, ZoneCode } from "../lib/types.js";

type SlabPrices = Record<SlabKey, number>;

async function loadClientSlabPrices(clientRateCardId: string, zoneCode: ZoneCode): Promise<SlabPrices> {
  const { data, error } = await supabase
    .from("client_rate_card_slab_prices")
    .select("slab_key, price_rupees")
    .eq("client_rate_card_id", clientRateCardId)
    .eq("zone_code", zoneCode);

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(`No client rate card prices found for client_rate_card_id=${clientRateCardId} zone=${zoneCode}`);
  }

  const prices = {} as SlabPrices;
  for (const row of data) {
    prices[row.slab_key as SlabKey] = Number(row.price_rupees);
  }
  return prices;
}

export interface CurrentClientRateCard {
  id: string;
  fuelSurchargePercent: number;
}

/** Returns null when the client has no rate card yet — billing is deferred, not guessed. */
export async function getCurrentClientRateCard(clientId: string): Promise<CurrentClientRateCard | null> {
  const { data, error } = await supabase
    .from("current_client_rate_cards")
    .select("id, fuel_surcharge_percent")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, fuelSurchargePercent: Number(data.fuel_surcharge_percent) };
}

export interface ClientBillResult {
  clientRateCardId: string;
  clientBilledAmountRupees: number;
  clientCodChargeRupees: number;
}

/**
 * Sell-side counterpart to the vendor rate engine's calculateFallbackRate —
 * same slab-pricing math (calculateSlabPriceRupees is carrier/client-agnostic),
 * read against the client's own rate card instead of the vendor's.
 */
export async function calculateClientBilledAmount(params: {
  clientId: string;
  zoneCode: ZoneCode;
  chargeableWeightGrams: number;
  paymentMode: PaymentMode;
  shipmentValueRupees: number;
}): Promise<ClientBillResult | null> {
  const rateCard = await getCurrentClientRateCard(params.clientId);
  if (!rateCard) return null;

  const prices = await loadClientSlabPrices(rateCard.id, params.zoneCode);
  const baseCostRupees = calculateSlabPriceRupees(params.chargeableWeightGrams, prices);
  const withFuelSurcharge = baseCostRupees * (1 + rateCard.fuelSurchargePercent / 100);
  const codChargeRupees = params.paymentMode === "COD" ? calculateCodChargeRupees(params.shipmentValueRupees) : 0;

  return {
    clientRateCardId: rateCard.id,
    clientBilledAmountRupees: withFuelSurcharge + codChargeRupees,
    clientCodChargeRupees: codChargeRupees,
  };
}
