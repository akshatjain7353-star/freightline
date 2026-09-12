import { supabase } from "../supabase/client.js";

export interface CurrentRateCard {
  id: string;
  fuelSurchargePercent: number;
}

/**
 * Resolves the single open-ended (effective_to is null) rate card for a
 * carrier. Used both to price a quote and to tag the shipment row with
 * exactly which rate card version was active at booking time.
 */
export async function getCurrentRateCard(carrierCode: string): Promise<CurrentRateCard> {
  const { data: carrier, error: carrierError } = await supabase
    .from("carriers")
    .select("id")
    .eq("code", carrierCode)
    .single();
  if (carrierError || !carrier) {
    throw new Error(`Carrier ${carrierCode} not found in carriers table`);
  }

  const { data: rateCard, error: rateCardError } = await supabase
    .from("current_rate_cards")
    .select("id, fuel_surcharge_percent")
    .eq("carrier_id", carrier.id)
    .single();
  if (rateCardError || !rateCard) {
    throw new Error(`No current rate card found for carrier "${carrierCode}"`);
  }

  return { id: rateCard.id, fuelSurchargePercent: Number(rateCard.fuel_surcharge_percent) };
}
