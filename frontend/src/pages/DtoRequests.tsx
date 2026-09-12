import { useEffect, useState } from "react";
import { AppLayout } from "../components/layout/AppLayout";
import { approveDtoRequest, fetchDtoRequests, rejectDtoRequest, type DtoRequest } from "../api/backend";

const inputClass =
  "bg-surface2 border border-border rounded px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-accent w-full";

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function DtoRequests() {
  const [requests, setRequests] = useState<DtoRequest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [pickupDate, setPickupDate] = useState(tomorrow());
  const [rejectReason, setRejectReason] = useState("");

  function loadQueue() {
    setLoading(true);
    setError(null);
    fetchDtoRequests()
      .then((res) => setRequests(res.requests))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(loadQueue, []);

  async function handleApprove(id: string) {
    setBusyRow(id);
    setError(null);
    try {
      await approveDtoRequest(id, pickupDate);
      setExpandedRow(null);
      loadQueue();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyRow(null);
    }
  }

  async function handleReject(id: string) {
    setBusyRow(id);
    setError(null);
    try {
      await rejectDtoRequest(id, rejectReason || "Rejected by ops");
      setExpandedRow(null);
      setRejectReason("");
      loadQueue();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyRow(null);
    }
  }

  return (
    <AppLayout title="DTO Requests">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-secondary max-w-2xl">
          Reverse-pickup/RTV requests submitted by client systems via the API, awaiting approval before a real
          carrier booking is made.
        </p>

        {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}

        {loading ? (
          <div className="text-sm text-muted py-8 text-center">Loading…</div>
        ) : !requests || requests.length === 0 ? (
          <div className="text-sm text-muted py-8 text-center border border-dashed border-border rounded">
            No pending DTO requests.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {requests.map((r) => (
              <div key={r.id} className="bg-surface border border-border rounded p-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-primary">{r.customer_name}</span>
                      <span className="text-xs text-muted">for {r.clients?.name ?? "—"}</span>
                      {r.external_reference && (
                        <span className="text-xs text-muted font-mono">ref: {r.external_reference}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted font-mono mt-0.5">
                      {r.pickup_address_line}, {r.pickup_city} ({r.pickup_pincode}) → {r.destination_pincode}
                    </div>
                    {r.reason && <div className="text-xs text-secondary mt-0.5">Reason: {r.reason}</div>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setExpandedRow(expandedRow === `${r.id}-approve` ? null : `${r.id}-approve`)}
                      className="text-xs px-2 py-1 rounded border border-success/40 text-success hover:bg-success/10"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setExpandedRow(expandedRow === `${r.id}-reject` ? null : `${r.id}-reject`)}
                      className="text-xs px-2 py-1 rounded border border-danger/40 text-danger hover:bg-danger/10"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {expandedRow === `${r.id}-approve` && (
                  <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
                    <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className={inputClass} />
                    <button
                      disabled={busyRow === r.id}
                      onClick={() => handleApprove(r.id)}
                      className="text-xs px-3 py-1.5 rounded bg-success/90 text-white hover:opacity-90 disabled:opacity-50 shrink-0"
                    >
                      {busyRow === r.id ? "Booking..." : "Confirm & Book"}
                    </button>
                  </div>
                )}

                {expandedRow === `${r.id}-reject` && (
                  <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
                    <input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejecting"
                      className={inputClass}
                    />
                    <button
                      disabled={busyRow === r.id}
                      onClick={() => handleReject(r.id)}
                      className="text-xs px-3 py-1.5 rounded bg-danger/90 text-white hover:opacity-90 disabled:opacity-50 shrink-0"
                    >
                      {busyRow === r.id ? "Rejecting..." : "Confirm Reject"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
