import { supabase } from "../supabase/client.js";
import { writeAuditLog } from "./audit-log-service.js";
import type { RateType, SlabKey } from "../rate-engine/rate-card-calculator.js";

export interface ClientRateCardWithSlabs {
  id: string;
  client_id: string;
  name: string;
  fuel_surcharge_percent: number;
  cod_charge_percent: number;
  cod_charge_minimum_rupees: number;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
  slab_prices: { slab_key: SlabKey; zone_code: string; price_rupees: number; rate_type: RateType }[];
}

export async function listClientRateCards(clientId: string): Promise<ClientRateCardWithSlabs[]> {
  const { data: rateCards, error } = await supabase
    .from("client_rate_cards")
    .select("id, client_id, name, fuel_surcharge_percent, cod_charge_percent, cod_charge_minimum_rupees, effective_from, effective_to, active")
    .eq("client_id", clientId)
    .order("effective_from", { ascending: false });
  if (error) throw error;

  const { data: slabRows, error: slabError } = await supabase
    .from("client_rate_card_slab_prices")
    .select("client_rate_card_id, slab_key, zone_code, price_rupees, rate_type")
    .in("client_rate_card_id", (rateCards ?? []).map((rc) => rc.id));
  if (slabError) throw slabError;

  return (rateCards ?? []).map((rc) => ({
    ...rc,
    slab_prices: (slabRows ?? [])
      .filter((s) => s.client_rate_card_id === rc.id)
      .map(({ slab_key, zone_code, price_rupees, rate_type }) => ({ slab_key, zone_code, price_rupees, rate_type })),
  })) as ClientRateCardWithSlabs[];
}

export interface NewClientRateCardVersionInput {
  clientId: string;
  name: string;
  fuelSurchargePercent: number;
  codChargePercent: number;
  codChargeMinimumRupees: number;
  effectiveFrom: string;
  slabPrices: { slabKey: SlabKey; zoneCode: string; priceRupees: number; rateType: RateType }[];
}

/** Same close-old/open-new versioning pattern as rate-card-service.ts's createNewRateCardVersion. */
export async function createNewClientRateCardVersion(
  input: NewClientRateCardVersionInput,
  actorId: string | null | undefined,
) {
  const { data: currentCard } = await supabase
    .from("current_client_rate_cards")
    .select("id")
    .eq("client_id", input.clientId)
    .maybeSingle();

  if (currentCard) {
    const dayBefore = new Date(input.effectiveFrom);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const { error: closeError } = await supabase
      .from("client_rate_cards")
      .update({ effective_to: dayBefore.toISOString().slice(0, 10) })
      .eq("id", currentCard.id);
    if (closeError) throw closeError;
  }

  const { data: newCard, error: insertError } = await supabase
    .from("client_rate_cards")
    .insert({
      client_id: input.clientId,
      name: input.name,
      fuel_surcharge_percent: input.fuelSurchargePercent,
      cod_charge_percent: input.codChargePercent,
      cod_charge_minimum_rupees: input.codChargeMinimumRupees,
      effective_from: input.effectiveFrom,
      active: true,
    })
    .select()
    .single();
  if (insertError || !newCard) throw insertError ?? new Error("Failed to insert new client rate card");

  const { error: slabError } = await supabase.from("client_rate_card_slab_prices").insert(
    input.slabPrices.map((s) => ({
      client_rate_card_id: newCard.id,
      slab_key: s.slabKey,
      zone_code: s.zoneCode,
      price_rupees: s.priceRupees,
      rate_type: s.rateType,
    })),
  );
  if (slabError) throw slabError;

  await writeAuditLog({
    actorId,
    action: "client_rate_card.new_version",
    entityType: "client_rate_card",
    entityId: newCard.id,
    before: currentCard ? { closed_client_rate_card_id: currentCard.id } : null,
    after: { client_rate_card_id: newCard.id, client_id: input.clientId, effective_from: input.effectiveFrom },
  });

  return newCard;
}
