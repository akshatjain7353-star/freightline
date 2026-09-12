import { useState } from "react";
import { AppLayout } from "../components/layout/AppLayout";
import { Filters } from "../components/shipments/Filters";
import { useShipments, type ShipmentFilters } from "../hooks/useShipments";
import { useCarriers, useClients } from "../hooks/useReferenceData";
import { useAuth } from "../lib/auth-context";
import { updateCodCollectionStatus } from "../api/backend";
import type { CodCollectionStatus } from "../lib/types";

function formatRupees(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const COD_STATUS_CLASSES: Record<CodCollectionStatus, string> = {
  pending: "text-warning",
  collected: "text-info",
  remitted: "text-success",
};

export function CashReconciliation() {
  const { role } = useAuth();
  const canEditCod = role === "admin" || role === "accounts_ops";
  const [filters, setFilters] = useState<ShipmentFilters>({});
  const { data: shipments, isLoading, refetch } = useShipments(filters);
  const { data: carriers } = useCarriers();
  const { data: clients } = useClients();
  const [busyRow, setBusyRow] = useState<string | null>(null);

  async function handleCodStatus(shipmentId: string, status: CodCollectionStatus) {
    setBusyRow(shipmentId);
    try {
      await updateCodCollectionStatus(shipmentId, status);
      refetch();
    } finally {
      setBusyRow(null);
    }
  }

  const rows = shipments ?? [];
  const totals = rows.reduce(
    (acc, s) => ({
      clientBilled: acc.clientBilled + (s.client_billed_amount ?? 0),
      vendorCost: acc.vendorCost + (s.cost_rupees ?? 0),
    }),
    { clientBilled: 0, vendorCost: 0 },
  );

  return (
    <AppLayout title="Cash Reconciliation">
      <Filters filters={filters} onChange={setFilters} carriers={carriers ?? []} clients={clients ?? []} />

      {!isLoading && rows.length > 0 && (
        <div className="flex gap-4 mb-4 text-sm">
          <div className="bg-surface border border-border rounded px-3 py-2">
            <span className="text-xs text-muted block">Client charged (page total)</span>
            <span className="tabular-num">{formatRupees(totals.clientBilled)}</span>
          </div>
          <div className="bg-surface border border-border rounded px-3 py-2">
            <span className="text-xs text-muted block">Vendor paid (page total)</span>
            <span className="tabular-num">{formatRupees(totals.vendorCost)}</span>
          </div>
          <div className="bg-surface border border-border rounded px-3 py-2">
            <span className="text-xs text-muted block">Margin (page total)</span>
            <span className="tabular-num">{formatRupees(totals.clientBilled - totals.vendorCost)}</span>
          </div>
        </div>
      )}

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
                <th className="text-left font-medium px-3 py-2 border-b border-border">Client charged</th>
                <th className="text-left font-medium px-3 py-2 border-b border-border">Vendor paid</th>
                <th className="text-left font-medium px-3 py-2 border-b border-border">Margin</th>
                <th className="text-left font-medium px-3 py-2 border-b border-border">COD status</th>
                {canEditCod && <th className="text-left font-medium px-3 py-2 border-b border-border">Action</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const margin =
                  s.client_billed_amount !== null && s.cost_rupees !== null
                    ? s.client_billed_amount - s.cost_rupees
                    : null;
                return (
                  <tr key={s.id} className="border-b border-border">
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{s.order_id}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{s.client_name ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{s.payment_mode}</td>
                    <td className="px-3 py-2 tabular-num whitespace-nowrap">{formatRupees(s.client_billed_amount)}</td>
                    <td className="px-3 py-2 tabular-num whitespace-nowrap">{formatRupees(s.cost_rupees)}</td>
                    <td className="px-3 py-2 tabular-num whitespace-nowrap">{formatRupees(margin)}</td>
                    <td className={`px-3 py-2 whitespace-nowrap capitalize ${COD_STATUS_CLASSES[s.cod_collection_status]}`}>
                      {s.payment_mode === "COD" ? s.cod_collection_status : "—"}
                    </td>
                    {canEditCod && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        {s.payment_mode === "COD" && (
                          <div className="flex gap-1">
                            {(["pending", "collected", "remitted"] as const)
                              .filter((st) => st !== s.cod_collection_status)
                              .map((st) => (
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
