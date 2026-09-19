import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchClientShipment, fetchClientShipmentTracking } from "../../api/backend";
import { ClientPortalLayout } from "../../components/layout/ClientPortalLayout";
import { StatusPill } from "../../components/shipments/StatusPill";
import type { ShipmentStatus } from "../../lib/types";

export function ClientShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["client-shipment", id],
    enabled: !!id,
    queryFn: () => fetchClientShipment(id!),
  });
  const { data: tracking } = useQuery({
    queryKey: ["client-tracking", id],
    enabled: !!id,
    queryFn: () => fetchClientShipmentTracking(id!),
  });

  const shipment = data?.shipment;

  return (
    <ClientPortalLayout title={shipment?.awb ?? shipment?.order_id ?? "Shipment"}>
      <Link to="/client/shipments" className="text-xs text-secondary hover:text-primary underline decoration-dotted">
        ← All shipments
      </Link>

      {isLoading && <div className="text-sm text-muted py-8 text-center">Loading…</div>}
      {isError && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2 mt-4">
          Shipment not found, or it does not belong to your account.
        </div>
      )}

      {shipment && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="bg-surface border border-border rounded p-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted mb-1">AWB</div>
              <div className="font-mono">{shipment.awb ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Status</div>
              <StatusPill status={shipment.status as ShipmentStatus} />
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Order ID</div>
              <div className="font-mono text-xs">{shipment.order_id}</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Carrier</div>
              <div>{shipment.carrier_name ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Route</div>
              <div className="font-mono text-xs">
                {shipment.origin_pincode} → {shipment.destination_pincode}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Payment</div>
              <div>{shipment.payment_mode}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-muted mb-1">Delivery address</div>
              <div className="text-xs">
                {shipment.destination_address_line ?? "—"}
                {shipment.destination_city ? `, ${shipment.destination_city}` : ""}
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded p-4">
            <div className="text-sm font-medium text-secondary mb-3">Tracking</div>
            {tracking?.events && tracking.events.length > 0 ? (
              <ol className="flex flex-col gap-2">
                {tracking.events.map((event) => (
                  <li key={event.id} className="text-xs text-secondary flex flex-col sm:flex-row sm:gap-3">
                    <span className="font-mono text-muted shrink-0">
                      {new Date(event.event_timestamp).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    <span className="text-primary">{event.status}</span>
                    {event.location && <span className="text-muted">{event.location}</span>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-muted">
                {shipment.awb
                  ? "No tracking scans yet. Updates appear after the carrier reports a scan."
                  : "This shipment has no AWB yet, so carrier tracking is not available."}
              </p>
            )}
          </div>
        </div>
      )}
    </ClientPortalLayout>
  );
}
