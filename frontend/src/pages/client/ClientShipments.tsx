import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchClientProfile, fetchClientShipments } from "../../api/backend";
import { ClientPortalLayout } from "../../components/layout/ClientPortalLayout";
import { StatusPill } from "../../components/shipments/StatusPill";
import type { ShipmentStatus } from "../../lib/types";

export function ClientShipments() {
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const { data: profile } = useQuery({ queryKey: ["client-profile"], queryFn: fetchClientProfile });
  const { data, isLoading, isError } = useQuery({
    queryKey: ["client-shipments", submitted],
    queryFn: () => fetchClientShipments(0, submitted || undefined),
  });

  return (
    <ClientPortalLayout title={profile?.clientName ?? "Your shipments"}>
      <form
        className="flex flex-col sm:flex-row gap-2 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(search.trim());
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search AWB or order ID"
          className="flex-1 bg-surface2 border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent"
        />
        <button type="submit" className="bg-accent text-accent-fg rounded px-4 py-2 text-sm font-medium">
          Search
        </button>
      </form>

      {isError && (
        <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2 mb-4">
          Could not load shipments. Confirm the backend is running and migration 0024 is applied.
        </div>
      )}
      {isLoading && <div className="text-sm text-muted py-8 text-center">Loading…</div>}
      {!isLoading && data && data.rows.length === 0 && (
        <div className="text-sm text-muted border border-dashed border-border rounded p-6 text-center">
          {submitted
            ? "No shipments match that AWB or order ID."
            : "No shipments yet. Time Bound will list them here after they are booked."}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {data?.rows.map((row) => (
          <Link
            key={row.id}
            to={`/client/shipments/${row.id}`}
            className="bg-surface border border-border rounded p-4 hover:border-accent transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-sm text-primary truncate">{row.awb ?? "No AWB yet"}</div>
                <div className="text-xs text-muted mt-1">
                  Order <span className="font-mono">{row.order_id}</span>
                  {" · "}
                  {row.origin_pincode} → {row.destination_pincode}
                </div>
              </div>
              <StatusPill status={row.status as ShipmentStatus} />
            </div>
          </Link>
        ))}
      </div>
    </ClientPortalLayout>
  );
}
