import { supabase } from "../supabase/client.js";

export interface CashReconciliationFilters {
  status?: string;
  carrierId?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export type InvoiceStatus = "not_invoiced" | "pending" | "partial" | "paid";

export interface CashReconciliationRow {
  id: string;
  order_id: string;
  awb: string | null;
  client_id: string;
  client_name: string | null;
  payment_mode: "COD" | "Prepaid";
  status: string;
  created_at: string;
  invoice_value_rupees: number | null;
  cash_received_status: InvoiceStatus;
  cash_received_amount_rupees: number | null;
  amount_charged_to_customer_rupees: number | null;
  received_from_vendor: boolean | null;
  given_to_client: boolean | null;
}

/**
 * Payments (client_payment) are recorded per-client, not tied to a specific
 * invoice at the DB level - there's no client_payment.client_invoice_id.
 * This allocates each client's total payments across their invoices FIFO
 * (oldest invoice first), which is the closest honest approximation without
 * a schema change: correct when a client pays invoices in order (the normal
 * case), approximate if they don't.
 */
async function computeInvoiceStatuses(
  clientIds: string[],
): Promise<Map<string, { status: InvoiceStatus; allocatedRupees: number; totalRupees: number }>> {
  const result = new Map<string, { status: InvoiceStatus; allocatedRupees: number; totalRupees: number }>();
  if (clientIds.length === 0) return result;

  const { data: invoices, error: invoiceError } = await supabase
    .from("client_invoice")
    .select("id, client_id, total_rupees, created_at")
    .in("client_id", clientIds)
    .order("created_at", { ascending: true });
  if (invoiceError) throw invoiceError;

  const { data: payments, error: paymentError } = await supabase
    .from("client_payment")
    .select("client_id, amount_rupees")
    .in("client_id", clientIds);
  if (paymentError) throw paymentError;

  const paidPoolByClient = new Map<string, number>();
  for (const payment of payments ?? []) {
    paidPoolByClient.set(
      payment.client_id,
      (paidPoolByClient.get(payment.client_id) ?? 0) + Number(payment.amount_rupees),
    );
  }

  for (const invoice of invoices ?? []) {
    const pool = paidPoolByClient.get(invoice.client_id) ?? 0;
    const totalRupees = Number(invoice.total_rupees);
    const allocatedRupees = Math.min(pool, totalRupees);
    const status: InvoiceStatus = allocatedRupees >= totalRupees ? "paid" : allocatedRupees > 0 ? "partial" : "pending";
    result.set(invoice.id, { status, allocatedRupees, totalRupees });
    paidPoolByClient.set(invoice.client_id, pool - allocatedRupees);
  }

  return result;
}

export async function getCashReconciliationRows(
  filters: CashReconciliationFilters,
  page: number,
  pageSize: number,
): Promise<{ rows: CashReconciliationRow[]; totalCount: number }> {
  let query = supabase
    .from("shipments")
    .select(
      "id, order_id, awb, client_id, payment_mode, status, created_at, client_billed_amount, shipment_value_rupees, cod_collection_status, clients(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.carrierId) query = query.eq("carrier_id", filters.carrierId);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);
  if (filters.search) {
    query = query.or(
      `awb.ilike.%${filters.search}%,order_id.ilike.%${filters.search}%,origin_pincode.ilike.%${filters.search}%,destination_pincode.ilike.%${filters.search}%`,
    );
  }

  const { data: shipments, error, count } = await query;
  if (error) throw error;
  const rows = shipments ?? [];
  if (rows.length === 0) return { rows: [], totalCount: count ?? 0 };

  const shipmentIds = rows.map((s) => s.id);
  const { data: invoiceLines, error: lineError } = await supabase
    .from("client_invoice_line")
    .select("shipment_id, client_invoice_id")
    .in("shipment_id", shipmentIds);
  if (lineError) throw lineError;

  const invoiceIdByShipmentId = new Map((invoiceLines ?? []).map((l) => [l.shipment_id, l.client_invoice_id]));
  const clientIds = [...new Set(rows.map((s) => s.client_id))];
  const invoiceStatusById = await computeInvoiceStatuses(clientIds);

  const resultRows: CashReconciliationRow[] = rows.map((s) => {
    const invoiceId = invoiceIdByShipmentId.get(s.id);
    const invoiceStatus = invoiceId ? invoiceStatusById.get(invoiceId) : undefined;
    const isCod = s.payment_mode === "COD";

    return {
      id: s.id,
      order_id: s.order_id,
      awb: s.awb,
      client_id: s.client_id,
      client_name: (s.clients as unknown as { name: string } | null)?.name ?? null,
      payment_mode: s.payment_mode,
      status: s.status,
      created_at: s.created_at,
      invoice_value_rupees: s.client_billed_amount,
      cash_received_status: invoiceStatus?.status ?? "not_invoiced",
      cash_received_amount_rupees: invoiceStatus?.status === "partial" ? invoiceStatus.allocatedRupees : null,
      amount_charged_to_customer_rupees: isCod ? s.shipment_value_rupees : null,
      received_from_vendor: isCod ? s.cod_collection_status === "collected" || s.cod_collection_status === "remitted" : null,
      given_to_client: isCod ? s.cod_collection_status === "remitted" : null,
    };
  });

  return { rows: resultRows, totalCount: count ?? 0 };
}
