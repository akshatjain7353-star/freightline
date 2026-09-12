import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../components/layout/AppLayout";
import { StatusPill } from "../components/shipments/StatusPill";
import { useRelatedShipments, useShipment } from "../hooks/useShipments";
import { fetchShipmentLabel, initiateDto, schedulePickup } from "../api/backend";

const inputClass =
  "bg-surface2 border border-border rounded px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-accent";

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatRupees(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: shipment, isLoading } = useShipment(id);
  const { data: relatedShipments } = useRelatedShipments(id);
  const queryClient = useQueryClient();

  const [pickupDate, setPickupDate] = useState(tomorrow());
  const [dtoDate, setDtoDate] = useState(tomorrow());
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSchedulePickup() {
    if (!id) return;
    setBusy("pickup");
    setMessage(null);
    try {
      await schedulePickup(id, pickupDate);
      setMessage({ type: "success", text: `Pickup scheduled for ${pickupDate}.` });
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function handleViewLabel() {
    if (!id) return;
    setBusy("label");
    setMessage(null);
    try {
      const result = await fetchShipmentLabel(id);
      if (result.labelUrl) {
        window.open(result.labelUrl, "_blank", "noopener,noreferrer");
      } else {
        setMessage({ type: "error", text: "Carrier did not return a label URL." });
      }
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function handleInitiateDto() {
    if (!id) return;
    setBusy("dto");
    setMessage(null);
    try {
      const result = await initiateDto(id, dtoDate);
      setMessage({ type: "success", text: `DTO initiated. New AWB: ${result.shipment.awb}` });
      queryClient.invalidateQueries({ queryKey: ["related-shipments", id] });
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) {
    return (
      <AppLayout title="Shipment">
        <div className="text-sm text-muted py-8 text-center">Loading…</div>
      </AppLayout>
    );
  }

  if (!shipment) {
    return (
      <AppLayout title="Shipment">
        <div className="text-sm text-muted py-8 text-center">Shipment not found.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Shipment ${shipment.awb ?? shipment.order_id}`}>
      <div className="flex flex-col gap-6 max-w-3xl">
        <div className="bg-surface border border-border rounded p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted mb-1">AWB</div>
            <div className="font-mono">{shipment.awb ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Status</div>
            <StatusPill status={shipment.status} />
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Client</div>
            <div>{shipment.client_name ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Route</div>
            <div className="font-mono text-xs">
              {shipment.origin_pincode} → {shipment.destination_pincode}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Weight</div>
            <div>{(shipment.chargeable_weight_grams / 1000).toFixed(2)} kg</div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">Cost</div>
            <div>{formatRupees(shipment.cost_rupees)}</div>
          </div>
        </div>

        {message && (
          <div
            className={`text-xs rounded px-2 py-1.5 border ${
              message.type === "success"
                ? "text-success bg-success/10 border-success/30"
                : "text-danger bg-danger/10 border-danger/30"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-surface border border-border rounded p-4 flex flex-col gap-3">
          <div className="text-sm font-medium text-secondary">Pickup &amp; Label</div>
          <div className="flex items-center gap-3 flex-wrap">
            <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className={inputClass} />
            <button
              onClick={handleSchedulePickup}
              disabled={busy === "pickup" || !shipment.awb}
              className="text-sm px-4 py-1.5 rounded bg-accent text-accent-fg hover:opacity-90 disabled:opacity-50"
            >
              {busy === "pickup" ? "Scheduling..." : "Schedule Pickup"}
            </button>
            <button
              onClick={handleViewLabel}
              disabled={busy === "label" || !shipment.awb}
              className="text-sm px-4 py-1.5 rounded border border-border text-secondary hover:text-primary hover:border-accent disabled:opacity-50"
            >
              {busy === "label" ? "Loading..." : "View / Print Label"}
            </button>
          </div>
        </div>

        {shipment.status !== "dto" && (
          <div className="bg-surface border border-border rounded p-4 flex flex-col gap-3">
            <div className="text-sm font-medium text-secondary">Initiate Return (DTO)</div>
            <p className="text-xs text-muted">
              Books a new reverse-pickup shipment (its own AWB) collecting from the customer and returning to origin.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <input type="date" value={dtoDate} onChange={(e) => setDtoDate(e.target.value)} className={inputClass} />
              <button
                onClick={handleInitiateDto}
                disabled={busy === "dto"}
                className="text-sm px-4 py-1.5 rounded bg-danger/90 text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy === "dto" ? "Booking..." : "Initiate DTO"}
              </button>
            </div>
          </div>
        )}

        {relatedShipments && relatedShipments.length > 0 && (
          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-border text-sm font-medium text-secondary">
              Linked DTO shipments
            </div>
            <table className="w-full text-sm">
              <tbody>
                {relatedShipments.map((rs) => (
                  <tr key={rs.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{rs.awb ?? "—"}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={rs.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-secondary">{formatRupees(rs.cost_rupees)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
