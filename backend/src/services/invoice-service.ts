import { supabase } from "../supabase/client.js";
import { writeAuditLog } from "./audit-log-service.js";
import { writeLedgerEntry } from "./client-ledger-service.js";

// Placeholder — confirm the real applicable GST rate (and whether it
// differs for logistics services) with whoever handles Time Bound's filing
// before invoices go out for real. Exported so the Dashboard's GST-inclusive
// revenue figure (dashboard-service.ts) always matches what invoicing
// actually charges, rather than risking a second hardcoded 18 drifting.
export const GST_RATE_PERCENT = 18;

export async function generateClientInvoice(
  clientId: string,
  periodFrom: string,
  periodTo: string,
  actorId: string | null | undefined,
) {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name, billing_state, gstin")
    .eq("id", clientId)
    .single();
  if (clientError || !client) throw new Error(`Client ${clientId} not found`);

  // Billed against client_billed_amount (what Time Bound charges the
  // client), not cost_rupees (what Time Bound pays the vendor) — those are
  // two different numbers now that client rate cards exist (Section 9's
  // "client price charged" vs "vendor price paid").
  const { data: shipments, error: shipmentsError } = await supabase
    .from("shipments")
    .select("id, order_id, client_billed_amount, created_at")
    .eq("client_id", clientId)
    .gte("created_at", periodFrom)
    .lte("created_at", `${periodTo}T23:59:59`)
    .not("client_billed_amount", "is", null);
  if (shipmentsError) throw shipmentsError;
  if (!shipments || shipments.length === 0) {
    throw new Error(
      `No billable shipments found for client ${clientId} in ${periodFrom}..${periodTo}. ` +
        `A shipment only gets a client_billed_amount if the client had a rate card at booking time.`,
    );
  }

  // Skip shipments already invoiced on a prior run (guards against
  // double-billing when period ranges overlap).
  const { data: alreadyInvoiced } = await supabase
    .from("client_invoice_line")
    .select("shipment_id")
    .in("shipment_id", shipments.map((s) => s.id));
  const invoicedIds = new Set((alreadyInvoiced ?? []).map((l) => l.shipment_id));
  const billableShipments = shipments.filter((s) => !invoicedIds.has(s.id));
  if (billableShipments.length === 0) {
    throw new Error(`Every shipment in this period for client ${clientId} has already been invoiced.`);
  }

  // Time Bound's own origin state isn't captured anywhere yet (see the
  // 0011_gst_invoicing.sql migration comment) — this defaults every line to
  // IGST until that's wired up, so review before invoices go out for real.
  const taxType: "cgst_sgst" | "igst" = "igst";

  const lines = billableShipments.map((s) => {
    const amount = Number(s.client_billed_amount);
    const tax = Math.round(amount * (GST_RATE_PERCENT / 100) * 100) / 100;
    return {
      shipment_id: s.id,
      description: `Freight — order ${s.order_id}`,
      amount_rupees: amount,
      tax_type: taxType,
      tax_rupees: tax,
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.amount_rupees, 0);
  const tax = lines.reduce((sum, l) => sum + l.tax_rupees, 0);

  const { data: invoice, error: invoiceError } = await supabase
    .from("client_invoice")
    .insert({
      client_id: clientId,
      period_from: periodFrom,
      period_to: periodTo,
      subtotal_rupees: subtotal,
      tax_rupees: tax,
      total_rupees: subtotal + tax,
      status: "draft",
      created_by: actorId ?? null,
    })
    .select()
    .single();
  if (invoiceError || !invoice) throw invoiceError ?? new Error("Failed to insert invoice");

  const { error: lineError } = await supabase
    .from("client_invoice_line")
    .insert(lines.map((l) => ({ ...l, client_invoice_id: invoice.id })));
  if (lineError) throw lineError;

  await writeLedgerEntry({
    clientId,
    entryType: "freight_debit",
    amountRupees: Number(invoice.total_rupees),
    description: `Invoice ${invoice.invoice_number}`,
    clientInvoiceId: invoice.id,
  });

  await writeAuditLog({
    actorId,
    action: "invoice.generated",
    entityType: "client_invoice",
    entityId: invoice.id,
    after: {
      client_id: clientId,
      period_from: periodFrom,
      period_to: periodTo,
      total_rupees: invoice.total_rupees,
      line_count: lines.length,
    },
  });

  return invoice;
}

export async function listClientInvoices(clientId?: string) {
  let query = supabase
    .from("client_invoice")
    .select("*, clients(name)")
    .order("created_at", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
