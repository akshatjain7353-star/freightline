import { useEffect, useState } from "react";
import { AppLayout } from "../components/layout/AppLayout";
import { Filters } from "../components/shipments/Filters";
import { Pagination } from "../components/common/Pagination";
import { useCarriers, useClients } from "../hooks/useReferenceData";
import { useAuth } from "../lib/auth-context";
import {
  fetchCashReconciliation,
  updateCodCollectionStatus,
  type CashReconciliationRow,
} from "../api/backend";
import type { ShipmentFilters } from "../hooks/useShipments";
import { StagingBanner } from "../components/common/StagingBanner";

const PAGE_SIZE = 50;

function formatRupees(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CASH_STATUS_LABELS: Record<CashReconciliationRow["cash_received_status"], string> = {
  not_invoiced: "Not invoiced",
  pending: "Pending",
  partial: "Partial",
  paid: "Paid",
};

const CASH_STATUS_CLASSES: Record<CashReconciliationRow["cash_received_status"], string> = {
  not_invoiced: "text-muted",
  pending: "text-warning",
  partial: "text-info",
  paid: "text-success",
};

function BoolBadge({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-muted">—</span>;
  return value ? <span className="text-success">Yes</span> : <span className="text-warning">No</span>;
}

export function CashReconciliation() {
  const { role } = useAuth();
  const canEditCod = role === "admin" || role === "accounts_ops";
  const [filters, setFilters] = useState<ShipmentFilters>({});
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<CashReconciliationRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const { data: carriers } = useCarriers();
  const { data: clients } = useClients();

  function load() {
    setIsLoading(true);
    fetchCashReconciliation(filters, page, PAGE_SIZE)
      .then((res) => {
        setRows(res.rows);
        setTotalCount(res.totalCount);
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [filters, page]);

  function handleFiltersChange(next: ShipmentFilters) {
    setFilters(next);
    setPage(0);
  }

  async function handleCodStatus(shipmentId: string, status: "pending" | "collected" | "remitted") {
    setBusyRow(shipmentId);
    try {
      await updateCodCollectionStatus(shipmentId, status);
      load();
    } finally {
      setBusyRow(null);
    }
  }

  return (
    <AppLayout title="Cash Reconciliation">
      <StagingBanner feature="cashReconciliation" />
      <Filters filters={filters} onChange={handleFiltersChange} carriers={carriers ?? []} clients={clients ?? []} />

      {isLoading ? (
        <div className="text-sm text-muted py-8 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted py-8 text-center border border-dashed border-border rounded">
          No shipments match these filters.
        </div>
      ) : (
        <div className="overflow-auto border border-border rounded">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-surface2 text-xs text-secondary uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-3 py-2 border-b border-border">Order</th>
                <th className="text-left font-medium px-3 py-2 border-b border-border">Client</th>
                <th className="text-left font-medium px-3 py-2 border-b border-border">Payment</th>
                <th className="text-left font-medium px-3 py-2 border-b border-border">Invoice Value</th>
                <th className="text-left font-medium px-3 py-2 border-b border-border">Cash Received</th>
                <th className="text-left font-medium px-3 py-2 border-b border-border">Charged to Customer</th>
                <th className="text-left font-medium px-3 py-2 border-b border-border">Received from Vendor</th>
                <th className="text-left font-medium px-3 py-2 border-b border-border">Given to Client</th>
                {canEditCod && <th className="text-left font-medium px-3 py-2 border-b border-border">Action</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{s.order_id}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{s.client_name ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{s.payment_mode}</td>
                  <td className="px-3 py-2 tabular-num whitespace-nowrap">{formatRupees(s.invoice_value_rupees)}</td>
                  <td className={`px-3 py-2 whitespace-nowrap ${CASH_STATUS_CLASSES[s.cash_received_status]}`}>
                    {CASH_STATUS_LABELS[s.cash_received_status]}
                    {s.cash_received_status === "partial" && s.cash_received_amount_rupees !== null && (
                      <span className="text-muted"> ({formatRupees(s.cash_received_amount_rupees)})</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-num whitespace-nowrap">
                    {formatRupees(s.amount_charged_to_customer_rupees)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <BoolBadge value={s.received_from_vendor} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <BoolBadge value={s.given_to_client} />
                  </td>
                  {canEditCod && (
                    <td className="px-3 py-2 whitespace-nowrap">
                      {s.payment_mode === "COD" && (
                        <div className="flex gap-1">
                          {(["pending", "collected", "remitted"] as const).map((st) => (
                            <button
                              key={st}
                              disabled={busyRow === s.id}
                              onClick={() => handleCodStatus(s.id, st)}
                              className="text-xs px-2 py-0.5 rounded border border-border text-secondary hover:text-primary hover:border-accent disabled:opacity-50 capitalize"
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!isLoading && <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />}
    </AppLayout>
  );
}
