/**
 * Removes every row scripts/seed-demo-data.ts created. Run manually via
 * `npm run cleanup:demo` from `backend/`. Never touches anything that
 * existed before seeding (e.g. the pre-existing "Test Client" itself, or
 * its own rate card if it had one already) - only rows tagged
 * is_seed_data = true (migration 0018), plus their FK-dependent children.
 *
 * Deletion order matters: several of the tables seed-demo-data.ts writes to
 * do NOT cascade-delete (client_ledger_entry's FKs, and shipments.client_
 * rate_card_id), so those references have to be removed first, in the
 * order below, before their parent rows can be deleted.
 */
import { supabase } from "../src/supabase/client.js";

async function idsWhereSeed(table: string): Promise<string[]> {
  const { data, error } = await supabase.from(table).select("id").eq("is_seed_data", true);
  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}

async function deleteByIds(table: string, column: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await supabase.from(table).delete().in(column, ids).select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

async function main() {
  console.log("Cleaning up demo data...\n");

  const seedShipmentIds = await idsWhereSeed("shipments");
  const seedInvoiceIds = await idsWhereSeed("client_invoice");
  const seedPaymentIds = await idsWhereSeed("client_payment");
  const seedBatchIds = await idsWhereSeed("carrier_remittance_batch");
  const seedRateCardIds = await idsWhereSeed("client_rate_cards");
  const seedClientIds = await idsWhereSeed("clients");

  let seedRemittanceLineIds: string[] = [];
  if (seedBatchIds.length > 0) {
    const { data, error } = await supabase
      .from("carrier_remittance_line")
      .select("id")
      .in("batch_id", seedBatchIds);
    if (error) throw error;
    seedRemittanceLineIds = (data ?? []).map((r) => r.id as string);
  }

  // 1. client_ledger_entry - no cascading FK anywhere, must go first.
  console.log("1. client_ledger_entry");
  let ledgerDeleted = 0;
  ledgerDeleted += await deleteByIds("client_ledger_entry", "client_invoice_id", seedInvoiceIds);
  ledgerDeleted += await deleteByIds("client_ledger_entry", "client_payment_id", seedPaymentIds);
  ledgerDeleted += await deleteByIds("client_ledger_entry", "carrier_remittance_line_id", seedRemittanceLineIds);
  ledgerDeleted += await deleteByIds("client_ledger_entry", "shipment_id", seedShipmentIds);
  console.log(`   deleted ${ledgerDeleted} rows`);

  // 2. carrier_remittance_batch (cascades to carrier_remittance_line).
  console.log("2. carrier_remittance_batch (+ its lines via cascade)");
  const batchesDeleted = await deleteByIds("carrier_remittance_batch", "id", seedBatchIds);
  console.log(`   deleted ${batchesDeleted} batches`);

  // 3. client_invoice (cascades to client_invoice_line).
  console.log("3. client_invoice (+ its lines via cascade)");
  const invoicesDeleted = await deleteByIds("client_invoice", "id", seedInvoiceIds);
  console.log(`   deleted ${invoicesDeleted} invoices`);

  // 4. client_payment.
  console.log("4. client_payment");
  const paymentsDeleted = await deleteByIds("client_payment", "id", seedPaymentIds);
  console.log(`   deleted ${paymentsDeleted} payments`);

  // 5. shipments (cascades to tracking_events + ndr_action_log). Must happen
  //    before client_rate_cards, since shipments.client_rate_card_id has no
  //    cascade and would block deleting a referenced rate card.
  console.log("5. shipments (+ tracking_events, ndr_action_log via cascade)");
  const shipmentsDeleted = await deleteByIds("shipments", "id", seedShipmentIds);
  console.log(`   deleted ${shipmentsDeleted} shipments`);

  // 6. client_rate_cards (cascades to client_rate_card_slab_prices).
  console.log("6. client_rate_cards (+ slab prices via cascade)");
  const rateCardsDeleted = await deleteByIds("client_rate_cards", "id", seedRateCardIds);
  console.log(`   deleted ${rateCardsDeleted} rate cards`);

  // 7. clients - only ones actually flagged is_seed_data (never the
  //    pre-existing "Test Client", even though it got a seeded rate card
  //    above - that rate card is gone now, the client itself stays).
  console.log("7. clients");
  const clientsDeleted = await deleteByIds("clients", "id", seedClientIds);
  console.log(`   deleted ${clientsDeleted} clients`);

  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Cleanup script failed:", err);
    process.exit(1);
  });
