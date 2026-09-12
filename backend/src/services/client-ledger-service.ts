import { supabase } from "../supabase/client.js";
import { writeAuditLog } from "./audit-log-service.js";

export async function writeLedgerEntry(entry: {
  clientId: string;
  entryType: "freight_debit" | "freight_credit" | "cod_credit" | "cod_debit";
  amountRupees: number;
  description: string;
  shipmentId?: string | null;
  clientInvoiceId?: string | null;
  clientPaymentId?: string | null;
  carrierRemittanceLineId?: string | null;
  settlementRunId?: string | null;
}) {
  const { error } = await supabase.from("client_ledger_entry").insert({
    client_id: entry.clientId,
    entry_type: entry.entryType,
    amount_rupees: entry.amountRupees,
    description: entry.description,
    shipment_id: entry.shipmentId ?? null,
    client_invoice_id: entry.clientInvoiceId ?? null,
    client_payment_id: entry.clientPaymentId ?? null,
    carrier_remittance_line_id: entry.carrierRemittanceLineId ?? null,
    settlement_run_id: entry.settlementRunId ?? null,
  });
  if (error) throw error;
}

export async function recordClientPayment(
  clientId: string,
  amountRupees: number,
  paymentDate: string,
  reference: string | undefined,
  actorId: string | null | undefined,
) {
  const { data: payment, error } = await supabase
    .from("client_payment")
    .insert({ client_id: clientId, amount_rupees: amountRupees, payment_date: paymentDate, reference: reference ?? null, recorded_by: actorId ?? null })
    .select()
    .single();
  if (error || !payment) throw error ?? new Error("Failed to record payment");

  await writeLedgerEntry({
    clientId,
    entryType: "freight_credit",
    amountRupees,
    description: reference ? `Payment received — ${reference}` : "Payment received",
    clientPaymentId: payment.id,
  });

  await writeAuditLog({
    actorId,
    action: "client_payment.recorded",
    entityType: "client_payment",
    entityId: payment.id,
    after: { client_id: clientId, amount_rupees: amountRupees, payment_date: paymentDate },
  });

  return payment;
}

export async function listClientLedgerEntries(clientId: string) {
  const { data, error } = await supabase
    .from("client_ledger_entry")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface ClientLedgerSummary {
  clientId: string;
  clientName: string;
  settlementMode: "netted" | "separate";
  freightBalanceRupees: number; // what the client owes Time Bound
  codBalanceRupees: number; // what Time Bound owes the client
  netBalanceRupees: number; // codBalance - freightBalance; positive = Time Bound owes client
}

/** Cross-client summary — outstanding freight receivable / COD payable at a glance, per Section 12's "who owes what" screen. */
export async function getClientLedgerSummaries(): Promise<ClientLedgerSummary[]> {
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name, settlement_mode");
  if (clientsError) throw clientsError;

  const { data: entries, error: entriesError } = await supabase
    .from("client_ledger_entry")
    .select("client_id, entry_type, amount_rupees");
  if (entriesError) throw entriesError;

  return (clients ?? []).map((client) => {
    const clientEntries = (entries ?? []).filter((e) => e.client_id === client.id);
    const sum = (type: string) =>
      clientEntries.filter((e) => e.entry_type === type).reduce((acc, e) => acc + Number(e.amount_rupees), 0);

    const freightBalanceRupees = sum("freight_debit") - sum("freight_credit");
    const codBalanceRupees = sum("cod_credit") - sum("cod_debit");

    return {
      clientId: client.id,
      clientName: client.name,
      settlementMode: client.settlement_mode,
      freightBalanceRupees,
      codBalanceRupees,
      netBalanceRupees: codBalanceRupees - freightBalanceRupees,
    };
  });
}
