import { supabase } from "../supabase/client.js";
import { writeAuditLog } from "./audit-log-service.js";
import { writeLedgerEntry } from "./client-ledger-service.js";

/**
 * Per-period netting for netted-mode clients (confirmed decision — not
 * per-shipment): sums every ledger entry in the period that hasn't already
 * been folded into a prior run, nets freight against COD, and records one
 * settlement covering the difference. Entries get tagged with the run so a
 * later overlapping period can't double-count them.
 */
export async function settlePeriod(clientId: string, periodFrom: string, periodTo: string, actorId: string | null | undefined) {
  const { data: entries, error: entriesError } = await supabase
    .from("client_ledger_entry")
    .select("id, entry_type, amount_rupees")
    .eq("client_id", clientId)
    .is("settlement_run_id", null)
    .gte("created_at", periodFrom)
    .lte("created_at", `${periodTo}T23:59:59`);
  if (entriesError) throw entriesError;
  if (!entries || entries.length === 0) {
    throw new Error(`No unsettled ledger entries for client ${clientId} in ${periodFrom}..${periodTo}.`);
  }

  const sum = (type: string) =>
    entries.filter((e) => e.entry_type === type).reduce((acc, e) => acc + Number(e.amount_rupees), 0);
  const freightTotal = sum("freight_debit") - sum("freight_credit");
  const codTotal = sum("cod_credit") - sum("cod_debit");
  const netAmount = codTotal - freightTotal; // positive = Time Bound pays the client

  const { data: run, error: runError } = await supabase
    .from("client_settlement_run")
    .insert({
      client_id: clientId,
      period_from: periodFrom,
      period_to: periodTo,
      freight_total_rupees: freightTotal,
      cod_total_rupees: codTotal,
      net_amount_rupees: netAmount,
      created_by: actorId ?? null,
    })
    .select()
    .single();
  if (runError || !run) throw runError ?? new Error("Failed to create settlement run");

  const { error: assignError } = await supabase
    .from("client_ledger_entry")
    .update({ settlement_run_id: run.id })
    .in("id", entries.map((e) => e.id));
  if (assignError) throw assignError;

  await writeAuditLog({
    actorId,
    action: "client.period_settled",
    entityType: "client_settlement_run",
    entityId: run.id,
    after: { client_id: clientId, period_from: periodFrom, period_to: periodTo, net_amount_rupees: netAmount },
  });

  return run;
}

/** Separate-mode clients: COD remittance out is its own cycle, independent of freight invoicing. */
export async function remitCodToClient(
  clientId: string,
  amountRupees: number,
  reference: string | undefined,
  actorId: string | null | undefined,
) {
  await writeLedgerEntry({
    clientId,
    entryType: "cod_debit",
    amountRupees,
    description: reference ? `COD remitted — ${reference}` : "COD remitted to client",
  });

  await writeAuditLog({
    actorId,
    action: "client.cod_remitted",
    entityType: "client",
    entityId: clientId,
    after: { amount_rupees: amountRupees, reference: reference ?? null },
  });
}

export async function listSettlementRuns(clientId: string) {
  const { data, error } = await supabase
    .from("client_settlement_run")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
