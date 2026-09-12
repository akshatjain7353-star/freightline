import { supabase } from "../supabase/client.js";
import { writeAuditLog } from "./audit-log-service.js";

export interface CarrierRemittanceRow {
  awb: string;
  remittedAmountRupees: number;
}

/**
 * Matches what the carrier actually remitted to Time Bound (COD collected
 * from end customers) against shipments by AWB. A match: flips the
 * shipment's cod_collection_status to 'collected' and credits the client's
 * ledger for the remitted amount — that's the money Time Bound now holds on
 * the client's behalf, per Section 12's COD side of the ledger.
 */
export async function reconcileCarrierRemittance(
  carrierCode: string,
  rows: CarrierRemittanceRow[],
  fileName: string | undefined,
  actorId: string | null | undefined,
) {
  const { data: carrier, error: carrierError } = await supabase
    .from("carriers")
    .select("id")
    .eq("code", carrierCode)
    .single();
  if (carrierError || !carrier) throw new Error(`Carrier ${carrierCode} not found`);

  const { data: batch, error: batchError } = await supabase
    .from("carrier_remittance_batch")
    .insert({ carrier_id: carrier.id, file_name: fileName ?? null, uploaded_by: actorId ?? null, total_lines: rows.length })
    .select()
    .single();
  if (batchError || !batch) throw batchError ?? new Error("Failed to create remittance batch");

  let matchedCount = 0;

  for (const row of rows) {
    const { data: shipment } = await supabase
      .from("shipments")
      .select("id, client_id, order_id, payment_mode")
      .eq("awb", row.awb)
      .maybeSingle();

    const matched = !!shipment && shipment.payment_mode === "COD";
    const { data: line, error: lineError } = await supabase
      .from("carrier_remittance_line")
      .insert({
        batch_id: batch.id,
        awb: row.awb,
        shipment_id: shipment?.id ?? null,
        remitted_amount_rupees: row.remittedAmountRupees,
        status: matched ? "matched" : "unmatched",
      })
      .select()
      .single();
    if (lineError || !line) throw lineError ?? new Error("Failed to insert remittance line");

    if (!matched || !shipment) continue;
    matchedCount++;

    const { error: updateError } = await supabase
      .from("shipments")
      .update({ cod_collection_status: "collected" })
      .eq("id", shipment.id);
    if (updateError) throw updateError;

    const { error: ledgerError } = await supabase.from("client_ledger_entry").insert({
      client_id: shipment.client_id,
      entry_type: "cod_credit",
      amount_rupees: row.remittedAmountRupees,
      description: `COD collected — order ${shipment.order_id}`,
      shipment_id: shipment.id,
      carrier_remittance_line_id: line.id,
    });
    if (ledgerError) throw ledgerError;
  }

  const { error: updateBatchError } = await supabase
    .from("carrier_remittance_batch")
    .update({ matched_lines: matchedCount })
    .eq("id", batch.id);
  if (updateBatchError) throw updateBatchError;

  await writeAuditLog({
    actorId,
    action: "carrier_remittance.reconciled",
    entityType: "carrier_remittance_batch",
    entityId: batch.id,
    after: { total: rows.length, matched: matchedCount },
  });

  return { batchId: batch.id, totalLines: rows.length, matched: matchedCount };
}

export async function listCarrierRemittanceLines(batchId: string) {
  const { data, error } = await supabase
    .from("carrier_remittance_line")
    .select("*")
    .eq("batch_id", batchId)
    .order("status", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
