import { supabase } from "../supabase/client.js";
import { writeAuditLog } from "./audit-log-service.js";
import type { RateType, SlabKey } from "../rate-engine/rate-card-calculator.js";

export interface RateCardWithSlabs {
  id: string;
  carrier_id: string;
  name: string;
  fuel_surcharge_percent: number;
  cod_charge_percent: number;
  cod_charge_minimum_rupees: number;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
  slab_prices: { slab_key: SlabKey; zone_code: string; price_rupees: number; rate_type: RateType }[];
}

export async function listRateCards(carrierCode: string): Promise<RateCardWithSlabs[]> {
  const { data: carrier, error: carrierError } = await supabase
    .from("carriers")
    .select("id")
    .eq("code", carrierCode)
    .single();
  if (carrierError || !carrier) throw new Error(`Carrier ${carrierCode} not found`);

  const { data: rateCards, error } = await supabase
    .from("rate_cards")
    .select("id, carrier_id, name, fuel_surcharge_percent, cod_charge_percent, cod_charge_minimum_rupees, effective_from, effective_to, active")
    .eq("carrier_id", carrier.id)
    .order("effective_from", { ascending: false });
  if (error) throw error;

  const { data: slabRows, error: slabError } = await supabase
    .from("rate_card_slab_prices")
    .select("rate_card_id, slab_key, zone_code, price_rupees, rate_type")
    .in("rate_card_id", (rateCards ?? []).map((rc) => rc.id));
  if (slabError) throw slabError;

  return (rateCards ?? []).map((rc) => ({
    ...rc,
    slab_prices: (slabRows ?? [])
      .filter((s) => s.rate_card_id === rc.id)
      .map(({ slab_key, zone_code, price_rupees, rate_type }) => ({ slab_key, zone_code, price_rupees, rate_type })),
  })) as RateCardWithSlabs[];
}

export interface NewRateCardVersionInput {
  carrierCode: string;
  name: string;
  fuelSurchargePercent: number;
  codChargePercent: number;
  codChargeMinimumRupees: number;
  effectiveFrom: string;
  slabPrices: { slabKey: SlabKey; zoneCode: string; priceRupees: number; rateType: RateType }[];
}

/**
 * Publishes a new rate card version: closes the currently-open version
 * (effective_to = day before the new one starts) and inserts the new row +
 * its slab prices (both forward and dto rate_type rows together). Historical
 * shipments keep pointing at the old row via shipments.rate_card_id, so past
 * invoices/quotes never shift.
 */
export async function createNewRateCardVersion(input: NewRateCardVersionInput, actorId: string | null | undefined) {
  const { data: carrier, error: carrierError } = await supabase
    .from("carriers")
    .select("id")
    .eq("code", input.carrierCode)
    .single();
  if (carrierError || !carrier) throw new Error(`Carrier ${input.carrierCode} not found`);

  const { data: currentCard } = await supabase
    .from("current_rate_cards")
    .select("id")
    .eq("carrier_id", carrier.id)
    .maybeSingle();

  if (currentCard) {
    const dayBefore = new Date(input.effectiveFrom);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const { error: closeError } = await supabase
      .from("rate_cards")
      .update({ effective_to: dayBefore.toISOString().slice(0, 10) })
      .eq("id", currentCard.id);
    if (closeError) throw closeError;
  }

  const { data: newCard, error: insertError } = await supabase
    .from("rate_cards")
    .insert({
      carrier_id: carrier.id,
      name: input.name,
      fuel_surcharge_percent: input.fuelSurchargePercent,
      cod_charge_percent: input.codChargePercent,
      cod_charge_minimum_rupees: input.codChargeMinimumRupees,
      effective_from: input.effectiveFrom,
      active: true,
    })
    .select()
    .single();
  if (insertError || !newCard) throw insertError ?? new Error("Failed to insert new rate card");

  const { error: slabError } = await supabase.from("rate_card_slab_prices").insert(
    input.slabPrices.map((s) => ({
      rate_card_id: newCard.id,
      slab_key: s.slabKey,
      zone_code: s.zoneCode,
      price_rupees: s.priceRupees,
      rate_type: s.rateType,
    })),
  );
  if (slabError) throw slabError;

  await writeAuditLog({
    actorId,
    action: "rate_card.new_version",
    entityType: "rate_card",
    entityId: newCard.id,
    before: currentCard ? { closed_rate_card_id: currentCard.id } : null,
    after: { rate_card_id: newCard.id, carrier_code: input.carrierCode, effective_from: input.effectiveFrom },
  });

  return newCard;
}
