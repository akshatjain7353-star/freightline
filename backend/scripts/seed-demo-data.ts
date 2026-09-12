/**
 * One-time demo data seeder. Run manually via `npm run seed:demo` from
 * `backend/`. NOT part of the app itself and never imported by it.
 *
 * Populates realistic-looking clients, rate cards, shipments, tracking
 * history, and reconciliation data directly into Supabase — no Delhivery API
 * calls of any kind (not even an attempted live rate quote that falls back;
 * every cost figure is computed by calling the exact same pure rate-engine
 * functions the real app uses, just skipping the "try the live API first"
 * step in rate.ts). Every row this script creates is tagged so
 * `npm run cleanup:demo` can remove all of it later without touching
 * anything that existed before this ran (e.g. the pre-existing "Test
 * Client") — see is_seed_data (migration 0018) and the "SEED-" prefix on
 * every order_id/awb this script generates.
 */
import { randomInt } from "node:crypto";
import { supabase } from "../src/supabase/client.js";
import { resolveZone } from "../src/rate-engine/zone-resolver.js";
import { calculateChargeableWeightGrams } from "../src/rate-engine/chargeable-weight.js";
import { calculateFallbackRate, type SlabKey } from "../src/rate-engine/rate-card-calculator.js";
import { getCurrentRateCard } from "../src/rate-engine/current-rate-card.js";
import { calculateClientBilledAmount } from "../src/rate-engine/client-rate-engine.js";
import { createNewClientRateCardVersion, listClientRateCards } from "../src/services/client-rate-card-service.js";
import { generateClientInvoice } from "../src/services/invoice-service.js";
import { recordClientPayment } from "../src/services/client-ledger-service.js";
import { reconcileCarrierRemittance } from "../src/services/carrier-remittance-service.js";
import type { Dimensions, PaymentMode } from "../src/lib/types.js";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function pick<T>(items: readonly T[]): T {
  return items[randomInt(items.length)]!;
}

function randInt(min: number, max: number): number {
  return min + randomInt(max - min + 1);
}

/** Weighted toward more recent days, so the 14-day chart shows a rising
 * trend rather than flat noise. daysAgo=0 is today. */
function pickDaysAgo(): number {
  const weights = Array.from({ length: 14 }, (_, daysAgo) => 14 - daysAgo);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let daysAgo = 0; daysAgo < 14; daysAgo++) {
    r -= weights[daysAgo]!;
    if (r <= 0) return daysAgo;
  }
  return 0;
}

function timestampDaysAgo(daysAgo: number, extraHours = 0): string {
  const ms = Date.now() - daysAgo * 86_400_000 - randInt(0, 86_400_000 - 1) + extraHours * 3_600_000;
  return new Date(ms).toISOString();
}

let seedCounter = 0;
function nextSeedId(): string {
  seedCounter += 1;
  return String(seedCounter).padStart(4, "0");
}

// ---------------------------------------------------------------------------
// Real pincode pairs from pincode_master (supabase/seed.sql) - never invent
// pincodes, since zone resolution needs real lat/lng entries to work.
// ---------------------------------------------------------------------------

const PINCODE_PAIRS: [string, string][] = [
  ["110001", "110037"], // Delhi, same city -> Zone A
  ["400001", "400069"], // Mumbai, same city -> Zone A
  ["560001", "560103"], // Bangalore, same city -> Zone A
  ["400001", "560001"], // Mumbai -> Bangalore
  ["110001", "380001"], // Delhi -> Ahmedabad
  ["500001", "600001"], // Hyderabad -> Chennai
  ["411001", "500081"], // Pune -> Hyderabad
  ["110001", "600001"], // Delhi -> Chennai
  ["110001", "560001"], // Delhi -> Bangalore
  ["700001", "400001"], // Kolkata -> Mumbai
  ["400001", "302001"], // Mumbai -> Jaipur
  ["560001", "226001"], // Bangalore -> Lucknow
  ["380001", "700091"], // Ahmedabad -> Kolkata
  ["600089", "500001"], // Chennai -> Hyderabad
  ["302001", "226001"], // Jaipur -> Lucknow
];

const NDR_REASONS = [
  "Customer not available",
  "Address incorrect / incomplete",
  "Customer refused delivery",
  "Customer unreachable on phone",
  "Requested reschedule",
];

// ---------------------------------------------------------------------------
// Clients + client rate cards
// ---------------------------------------------------------------------------

interface DemoClient {
  id: string;
  name: string;
  markupPercent: number;
  fuelSurchargePercent: number;
}

async function findOrCreateClient(name: string, email: string, isSeedIfCreated: boolean): Promise<string> {
  const { data: existing } = await supabase.from("clients").select("id").eq("name", name).maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("clients")
    .insert({ name, contact_info: { email }, is_seed_data: isSeedIfCreated })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error(`Failed to create client ${name}`);
  console.log(`  created client "${name}"`);
  return data.id;
}

async function ensureClientRateCard(client: DemoClient, delhiveryRateCardId: string) {
  const { data: vendorSlabs, error } = await supabase
    .from("rate_card_slab_prices")
    .select("slab_key, zone_code, price_rupees")
    .eq("rate_card_id", delhiveryRateCardId);
  if (error || !vendorSlabs) throw error ?? new Error("Could not load Delhivery slab prices to base client cards on");

  const slabPrices = vendorSlabs.map((s) => ({
    slabKey: s.slab_key as SlabKey,
    zoneCode: s.zone_code,
    priceRupees: Math.round(Number(s.price_rupees) * (1 + client.markupPercent / 100) * 100) / 100,
  }));

  const rateCard = await createNewClientRateCardVersion(
    {
      clientId: client.id,
      name: "Seed demo rate card",
      fuelSurchargePercent: client.fuelSurchargePercent,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      slabPrices,
    },
    null,
  );
  // createNewClientRateCardVersion doesn't take is_seed_data - tag it directly.
  await supabase.from("client_rate_cards").update({ is_seed_data: true }).eq("id", rateCard.id);
  console.log(`  published client rate card for ${client.name} (+${client.markupPercent}% over Delhivery)`);
}

// ---------------------------------------------------------------------------
// Shipment generation
// ---------------------------------------------------------------------------

interface GeneratedShipment {
  id: string;
  awb: string;
  clientId: string;
  status: string;
  paymentMode: PaymentMode;
  chargeableWeightGrams: number;
}

async function computeVendorQuote(
  originPincode: string,
  destinationPincode: string,
  weightGrams: number,
  dimensions: Dimensions,
  paymentMode: PaymentMode,
  shipmentValueRupees: number,
) {
  // Mirrors adapters/delhivery/rate.ts exactly, minus the "try the live API
  // first" step - this script never calls Delhivery at all.
  const zone = await resolveZone(originPincode, destinationPincode);
  const chargeableWeightGrams = calculateChargeableWeightGrams(weightGrams, dimensions);
  const currentRateCard = await getCurrentRateCard("delhivery");
  const fallback = await calculateFallbackRate({
    rateCardId: currentRateCard.id,
    zoneCode: zone.zoneCode,
    chargeableWeightGrams,
    paymentMode,
    shipmentValueRupees,
    fuelSurchargePercent: currentRateCard.fuelSurchargePercent,
  });
  return { zone, chargeableWeightGrams, rateCardId: currentRateCard.id, ...fallback };
}

async function createShipment(params: {
  client: DemoClient;
  carrierId: string;
  status: string;
  paymentMode: PaymentMode;
  daysAgo: number;
  weightGramsOverride?: number;
  forceWeightDiscrepancy?: boolean;
}): Promise<GeneratedShipment> {
  const [originPincode, destinationPincode] = pick(PINCODE_PAIRS);
  const weightGrams = params.weightGramsOverride ?? randInt(150, 3000);
  const dimensions: Dimensions = { lengthCm: randInt(8, 30), widthCm: randInt(8, 25), heightCm: randInt(5, 20) };
  const shipmentValueRupees = randInt(300, 3000);

  const quote = await computeVendorQuote(
    originPincode,
    destinationPincode,
    weightGrams,
    dimensions,
    params.paymentMode,
    shipmentValueRupees,
  );

  const clientBill = await calculateClientBilledAmount({
    clientId: params.client.id,
    zoneCode: quote.zone.zoneCode,
    chargeableWeightGrams: quote.chargeableWeightGrams,
    paymentMode: params.paymentMode,
    shipmentValueRupees,
  });

  const seedId = nextSeedId();
  const orderId = `SEED-ORD-${seedId}`;
  const awb = `SEED-AWB-${seedId}`;
  const createdAt = timestampDaysAgo(params.daysAgo);

  const vendorChargedWeight = params.forceWeightDiscrepancy
    ? quote.chargeableWeightGrams + randInt(15, 40)
    : undefined;

  const { data: shipment, error } = await supabase
    .from("shipments")
    .insert({
      awb,
      order_id: orderId,
      client_id: params.client.id,
      carrier_id: params.carrierId,
      origin_pincode: originPincode,
      destination_pincode: destinationPincode,
      destination_address_line: `${randInt(1, 999)}, Seed Demo Layout`,
      destination_city: "Demo City",
      weight_grams: weightGrams,
      length_cm: dimensions.lengthCm,
      width_cm: dimensions.widthCm,
      height_cm: dimensions.heightCm,
      chargeable_weight_grams: quote.chargeableWeightGrams,
      zone_code: quote.zone.zoneCode,
      zone_source: quote.zone.source,
      payment_mode: params.paymentMode,
      status: params.status,
      rate_card_id: quote.rateCardId,
      cost_rupees: quote.totalCostRupees,
      cod_charge_rupees: quote.codChargeRupees,
      fuel_surcharge_percent_applied: quote.fuelSurchargePercentApplied,
      shipment_value_rupees: shipmentValueRupees,
      client_rate_card_id: clientBill?.clientRateCardId ?? null,
      client_billed_amount: clientBill?.clientBilledAmountRupees ?? null,
      client_cod_charge_rupees: clientBill?.clientCodChargeRupees ?? 0,
      raw_booking_response: { seed: true },
      is_seed_data: true,
      created_at: createdAt,
      updated_at: createdAt,
      ...(vendorChargedWeight !== undefined ? { vendor_charged_weight: vendorChargedWeight } : {}),
      ...(params.status === "ndr" || params.status === "rto" ? { ndr_attempt_count: randInt(1, 3) } : {}),
    })
    .select("id, awb, client_id, status, payment_mode, chargeable_weight_grams, created_at, ndr_attempt_count")
    .single();
  if (error || !shipment) throw error ?? new Error("Failed to insert seed shipment");

  await seedTrackingEvents(shipment.id, shipment.status, shipment.created_at);

  return {
    id: shipment.id,
    awb: shipment.awb,
    clientId: shipment.client_id,
    status: shipment.status,
    paymentMode: shipment.payment_mode,
    chargeableWeightGrams: shipment.chargeable_weight_grams,
  };
}

async function seedTrackingEvents(shipmentId: string, status: string, createdAt: string) {
  const base = new Date(createdAt).getTime();
  const events: { status: string; location: string; hoursAfter: number }[] = [
    { status: "Booked", location: "Origin hub", hoursAfter: 0 },
  ];

  if (status === "pending") {
    // No movement yet - matches real pre-pickup behaviour.
  } else if (status === "in_transit") {
    events.push({ status: "Picked Up", location: "Origin hub", hoursAfter: 6 });
    events.push({ status: "In Transit", location: "Transit hub", hoursAfter: 30 });
  } else if (status === "delivered") {
    events.push({ status: "Picked Up", location: "Origin hub", hoursAfter: 6 });
    events.push({ status: "In Transit", location: "Transit hub", hoursAfter: 30 });
    events.push({ status: "Delivered", location: "Destination", hoursAfter: randInt(48, 96) });
  } else if (status === "ndr") {
    events.push({ status: "Picked Up", location: "Origin hub", hoursAfter: 6 });
    events.push({ status: "In Transit", location: "Transit hub", hoursAfter: 30 });
    events.push({ status: "Undelivered - NDR", location: "Destination hub", hoursAfter: randInt(48, 72) });
  } else if (status === "rto") {
    events.push({ status: "Picked Up", location: "Origin hub", hoursAfter: 6 });
    events.push({ status: "In Transit", location: "Transit hub", hoursAfter: 30 });
    events.push({ status: "Undelivered - NDR", location: "Destination hub", hoursAfter: 60 });
    events.push({ status: "RTO Initiated", location: "Destination hub", hoursAfter: 84 });
  } else if (status === "dto") {
    events.push({ status: "Reverse Pickup Scheduled", location: "Customer address", hoursAfter: 6 });
    events.push({ status: "Reverse Pickup Completed", location: "Customer address", hoursAfter: 24 });
  }

  const rows = events.map((e) => ({
    shipment_id: shipmentId,
    status: e.status,
    event_timestamp: new Date(base + e.hoursAfter * 3_600_000).toISOString(),
    location: e.location,
    raw_carrier_payload: { seed: true },
  }));

  const { error } = await supabase.from("tracking_events").insert(rows);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding demo data...\n");

  console.log("Clients:");
  const testClientId = await findOrCreateClient("Test Client", "test@example.com", false);
  const cometShoesId = await findOrCreateClient("Comet Shoes", "ops@cometshoes.example.com", true);
  const novaThreadsId = await findOrCreateClient("Nova Threads", "hello@novathreads.example.com", true);

  const clients: DemoClient[] = [
    { id: testClientId, name: "Test Client", markupPercent: 18, fuelSurchargePercent: 0 },
    { id: cometShoesId, name: "Comet Shoes", markupPercent: 25, fuelSurchargePercent: 0 },
    { id: novaThreadsId, name: "Nova Threads", markupPercent: 15, fuelSurchargePercent: 3 },
  ];

  console.log("\nRate cards:");
  const { data: delhiveryCarrier } = await supabase.from("carriers").select("id").eq("code", "delhivery").single();
  if (!delhiveryCarrier) throw new Error("Delhivery carrier not found - run the base migrations/seed first.");
  const delhiveryRateCard = await getCurrentRateCard("delhivery");
  for (const client of clients) {
    const existing = await listClientRateCards(client.id);
    if (existing.some((rc) => !rc.effective_to && rc.active)) {
      console.log(`  ${client.name} already has a current rate card, skipping`);
      continue;
    }
    await ensureClientRateCard(client, delhiveryRateCard.id);
  }

  console.log("\nShipments:");
  const TOTAL = 70;
  const counts = {
    delivered: Math.round(TOTAL * 0.6),
    in_transit: Math.round(TOTAL * 0.08),
    pending: Math.round(TOTAL * 0.07),
    ndr: Math.round(TOTAL * 0.1),
    rto: Math.round(TOTAL * 0.08),
    dto: Math.round(TOTAL * 0.05),
  };
  // Round to exactly TOTAL, absorbing rounding drift into "delivered".
  const assignedSoFar = Object.values(counts).reduce((a, b) => a + b, 0) - counts.delivered;
  counts.delivered = TOTAL - assignedSoFar;

  const statusPlan: string[] = [
    ...Array(counts.delivered).fill("delivered"),
    ...Array(counts.in_transit).fill("in_transit"),
    ...Array(counts.pending).fill("pending"),
    ...Array(counts.ndr).fill("ndr"),
    ...Array(counts.rto).fill("rto"),
    ...Array(counts.dto).fill("dto"),
  ];
  console.log(`  plan: ${JSON.stringify(counts)}`);

  const created: GeneratedShipment[] = [];
  const ndrShipments: GeneratedShipment[] = [];

  for (let i = 0; i < statusPlan.length; i++) {
    const status = statusPlan[i]!;
    const client = pick(clients);
    const paymentMode: PaymentMode = Math.random() < 0.4 ? "COD" : "Prepaid";
    // The first 2 "delivered" shipments get a forced, small chargeable
    // weight so the vendor_charged_weight trigger's >10% threshold is
    // actually crossed by a realistic 15-40g gap (see 0007_shipment_schema_fixes.sql).
    const forceWeightDiscrepancy = status === "delivered" && created.filter((s) => s.status === "delivered").length < 2;

    const shipment = await createShipment({
      client,
      carrierId: delhiveryCarrier.id,
      status,
      paymentMode,
      daysAgo: pickDaysAgo(),
      weightGramsOverride: forceWeightDiscrepancy ? randInt(150, 220) : undefined,
      forceWeightDiscrepancy,
    });
    created.push(shipment);
    if (status === "ndr") ndrShipments.push(shipment);

    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${statusPlan.length} shipments created`);
  }
  console.log(`  done — ${created.length} shipments created`);

  console.log("\nNDR action log:");
  for (const shipment of ndrShipments.slice(0, 2)) {
    await supabase.from("ndr_action_log").insert({
      shipment_id: shipment.id,
      action: "reattempt_requested",
      notes: pick(NDR_REASONS),
      attempt_number: 1,
    });
    console.log(`  logged a reattempt for shipment ${shipment.awb}`);
  }

  console.log("\nCarrier COD remittance:");
  const codDelivered = created.filter((s) => s.paymentMode === "COD" && s.status === "delivered");
  if (codDelivered.length > 0) {
    const sampleSize = Math.min(8, codDelivered.length);
    const sample = codDelivered.slice(0, sampleSize);
    const rows = sample.map((s) => ({ awb: s.awb, remittedAmountRupees: randInt(300, 3000) }));
    // carrier_remittance_line's schema only supports matched/unmatched (no
    // "discrepancy" state like vendor_invoice_line has) - 1-2 lines use a
    // made-up AWB so they land as "unmatched", the closest real analog this
    // table supports to a remittance discrepancy.
    rows.push({ awb: "SEED-AWB-UNMATCHED-0001", remittedAmountRupees: randInt(300, 3000) });
    if (sampleSize >= 2) rows.push({ awb: "SEED-AWB-UNMATCHED-0002", remittedAmountRupees: randInt(300, 3000) });

    const result = await reconcileCarrierRemittance("delhivery", rows, "seed-demo-remittance.csv", null);
    await supabase.from("carrier_remittance_batch").update({ is_seed_data: true }).eq("id", result.batchId);
    console.log(`  batch ${result.batchId}: ${result.matched}/${result.totalLines} matched`);
  } else {
    console.log("  skipped — no COD-delivered shipments generated this run");
  }

  console.log("\nClient invoice + payment:");
  const invoiceClient = clients.find((c) => c.name === "Comet Shoes")!;
  // Exact calendar-date bounds (not the randomized timestampDaysAgo helper,
  // which can land a day either side of the intended date) - must cleanly
  // cover every shipment's created_at, which is always within the last 14
  // days per pickDaysAgo().
  const periodFrom = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  const periodTo = new Date().toISOString().slice(0, 10);
  try {
    const draftInvoice = await generateClientInvoice(testClientId, periodFrom, periodTo, null);
    await supabase.from("client_invoice").update({ is_seed_data: true }).eq("id", draftInvoice.id);
    console.log(`  draft invoice ${draftInvoice.invoice_number} for Test Client (₹${draftInvoice.total_rupees})`);
  } catch (err) {
    console.log(`  skipped draft invoice for Test Client: ${(err as Error).message}`);
  }

  try {
    const sentInvoice = await generateClientInvoice(invoiceClient.id, periodFrom, periodTo, null);
    await supabase
      .from("client_invoice")
      .update({ status: "issued", is_seed_data: true })
      .eq("id", sentInvoice.id);
    console.log(`  issued invoice ${sentInvoice.invoice_number} for ${invoiceClient.name} (₹${sentInvoice.total_rupees})`);

    const partialAmount = Math.round(Number(sentInvoice.total_rupees) * 0.6 * 100) / 100;
    const payment = await recordClientPayment(
      invoiceClient.id,
      partialAmount,
      timestampDaysAgo(2).slice(0, 10),
      `Partial payment - ${sentInvoice.invoice_number}`,
      null,
    );
    await supabase.from("client_payment").update({ is_seed_data: true }).eq("id", payment.id);
    console.log(`  recorded partial payment of ₹${partialAmount} against it`);
  } catch (err) {
    console.log(`  skipped issued invoice/payment for ${invoiceClient.name}: ${(err as Error).message}`);
  }

  console.log("\nDone. Run `npm run cleanup:demo` to remove all seeded data later.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed script failed:", err);
    process.exit(1);
  });
