import type { Shipment } from "../../lib/types";
import { StatusPill } from "./StatusPill";

const columns = [
  "AWB",
  "Client / Route",
  "Carrier",
  "Zone",
  "Weight",
  "Payment",
  "Status",
  "Cost",
  "Created",
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function formatRupees(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ShipmentsTable({ shipments, isLoading }: { shipments: Shipment[]; isLoading: boolean }) {
  if (isLoading) {
    return <div className="text-sm text-muted py-8 text-center">Loading shipments...</div>;
  }

  if (shipments.length === 0) {
    return <div className="text-sm text-muted py-8 text-center">No shipments match these filters.</div>;
  }

  return (
    <div className="overflow-auto border border-border rounded">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-surface2 text-xs text-secondary uppercase tracking-wide">
          <tr>
            {columns.map((col) => (
              <th key={col} className="text-left font-medium px-3 py-2 border-b border-border whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shipments.map((s) => (
            <tr key={s.id} className="border-b border-border hover:bg-surface2/60 transition-colors">
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{s.awb ?? "—"}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="text-primary">{s.clients?.name ?? "—"}</div>
                <div className="text-xs text-muted font-mono">
                  {s.origin_pincode} → {s.destination_pincode}
                </div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{s.carriers?.name ?? "—"}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <span className="font-mono">{s.zone_code ?? "—"}</span>
                {s.zone_source === "computed" && (
                  <span className="ml-1 text-xs text-warning" title="Estimated zone (computed fallback)">
                    (est.)
                  </span>
                )}
              </td>
              <td className="px-3 py-2 tabular-num whitespace-nowrap">
                {(s.chargeable_weight_grams / 1000).toFixed(2)} kg
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{s.payment_mode}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <StatusPill status={s.status} />
              </td>
              <td className="px-3 py-2 tabular-num whitespace-nowrap">{formatRupees(s.cost_rupees)}</td>
              <td className="px-3 py-2 text-xs text-secondary whitespace-nowrap">{formatDate(s.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
