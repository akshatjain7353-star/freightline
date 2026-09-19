import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../components/layout/AppLayout";
import { useWeightDiscrepancies } from "../hooks/useShipments";
import { updateWeightDiscrepancyStatus } from "../api/backend";
import type { WeightDiscrepancyStatus } from "../lib/types";

const STATUS_LABELS: Record<WeightDiscrepancyStatus, string> = {
  flagged: "Flagged",
  accepted: "Accepted",
  disputed: "Disputed",
  resolved: "Resolved",
};

const STATUS_CLASSES: Record<WeightDiscrepancyStatus, string> = {
  flagged: "text-warning",
  accepted: "text-success",
  disputed: "text-danger",
  resolved: "text-muted",
};

export function WeightDiscrepancies() {
  const { data: shipments, isLoading } = useWeightDiscrepancies();
  const queryClient = useQueryClient();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(shipmentId: string, status: "accepted" | "disputed" | "resolved") {
    setActingOn(shipmentId);
    setError(null);
    try {
      await updateWeightDiscrepancyStatus(shipmentId, status);
      await queryClient.invalidateQueries({ queryKey: ["weight-discrepancies"] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActingOn(null);
    }
  }

  return (
    <AppLayout title="Weight Discrepancies">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-secondary max-w-2xl">
          Shipments where the vendor's reweighed (charged) weight differs from the declared chargeable weight by
          more than 10g. Review and accept, dispute with the carrier, or mark resolved.
        </p>
        <div className="text-xs text-muted bg-surface2 border border-border rounded px-3 py-2 max-w-2xl">
          Automatic flags from the tracking poller&apos;s <span className="font-mono">ChargedWeight</span> field
          are unverified. Use the manual vendor-weight entry on a shipment until that payload is confirmed.
        </div>

        {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}

        {isLoading ? (
          <div className="text-sm text-muted py-8 text-center">Loading…</div>
        ) : !shipments || shipments.length === 0 ? (
          <div className="text-sm text-muted py-8 text-center border border-dashed border-border rounded">
            No flagged weight discrepancies.
          </div>
        ) : (
          <div className="overflow-auto border border-border rounded">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-surface2 text-xs text-secondary uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-3 py-2 border-b border-border">AWB</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-border">Client</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-border">Declared</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-border">Vendor-charged</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-border">Delta</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-border">Status</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => {
                  const delta =
                    s.vendor_charged_weight !== null
                      ? (s.vendor_charged_weight - s.chargeable_weight_grams).toFixed(0)
                      : null;
                  const status = s.weight_discrepancy_status ?? "flagged";
                  return (
                    <tr key={s.id} className="border-b border-border">
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{s.awb ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{s.client_name ?? "—"}</td>
                      <td className="px-3 py-2 tabular-num whitespace-nowrap">{(s.chargeable_weight_grams / 1000).toFixed(2)} kg</td>
                      <td className="px-3 py-2 tabular-num whitespace-nowrap">
                        {s.vendor_charged_weight !== null ? `${(s.vendor_charged_weight / 1000).toFixed(2)} kg` : "—"}
                      </td>
                      <td className="px-3 py-2 tabular-num whitespace-nowrap text-warning">{delta !== null ? `${delta}g` : "—"}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            disabled={actingOn === s.id}
                            onClick={() => handleAction(s.id, "accepted")}
                            className="text-xs px-2 py-1 rounded border border-border text-secondary hover:text-primary hover:border-accent disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            disabled={actingOn === s.id}
                            onClick={() => handleAction(s.id, "disputed")}
                            className="text-xs px-2 py-1 rounded border border-border text-secondary hover:text-primary hover:border-accent disabled:opacity-50"
                          >
                            Dispute
                          </button>
                          <button
                            disabled={actingOn === s.id}
                            onClick={() => handleAction(s.id, "resolved")}
                            className="text-xs px-2 py-1 rounded border border-border text-secondary hover:text-primary hover:border-accent disabled:opacity-50"
                          >
                            Resolve
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
