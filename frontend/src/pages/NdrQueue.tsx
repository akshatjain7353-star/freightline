import { useEffect, useState } from "react";
import { AppLayout } from "../components/layout/AppLayout";
import { useCarriers } from "../hooks/useReferenceData";
import {
  contactNdrCustomer,
  convertNdrToRto,
  editNdrAddress,
  fetchNdrQueue,
  requestNdrReattempt,
} from "../api/backend";
import type { Shipment } from "../lib/types";

const inputClass =
  "bg-surface2 border border-border rounded px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-accent w-full";

export function NdrQueue() {
  const { data: carriers } = useCarriers();
  const [shipments, setShipments] = useState<Shipment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  function loadQueue() {
    setLoading(true);
    setError(null);
    fetchNdrQueue()
      .then((res) => setShipments(res.shipments))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(loadQueue, []);

  function maxAttemptsFor(carrierId: string): number {
    return carriers?.find((c) => c.id === carrierId)?.max_ndr_attempts ?? 3;
  }

  async function handleReattempt(shipmentId: string) {
    setBusyRow(shipmentId);
    setError(null);
    try {
      await requestNdrReattempt(shipmentId);
      loadQueue();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyRow(null);
    }
  }

  async function handleConvertToRto(shipmentId: string) {
    setBusyRow(shipmentId);
    setError(null);
    try {
      await convertNdrToRto(shipmentId);
      loadQueue();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyRow(null);
    }
  }

  async function handleSaveAddress(shipmentId: string) {
    setBusyRow(shipmentId);
    setError(null);
    try {
      await editNdrAddress(shipmentId, addressLine, city);
      setExpandedRow(null);
      loadQueue();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyRow(null);
    }
  }

  async function handleContact(shipmentId: string) {
    setBusyRow(shipmentId);
    setError(null);
    try {
      await contactNdrCustomer(shipmentId, notes || "Customer contacted");
      setExpandedRow(null);
      setNotes("");
      loadQueue();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyRow(null);
    }
  }

  return (
    <AppLayout title="NDR Queue">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-secondary max-w-2xl">
          Delivery-failure shipments needing action: request a reattempt, edit the delivery address, log a
          customer contact, or convert to RTO once the carrier's reattempt limit is reached.
        </p>

        {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}

        {loading ? (
          <div className="text-sm text-muted py-8 text-center">Loading…</div>
        ) : !shipments || shipments.length === 0 ? (
          <div className="text-sm text-muted py-8 text-center border border-dashed border-border rounded">
            No shipments in NDR.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {shipments.map((s) => {
              const maxAttempts = maxAttemptsFor(s.carrier_id);
              const atLimit = (s.ndr_attempt_count ?? 0) >= maxAttempts;
              return (
                <div key={s.id} className="bg-surface border border-border rounded p-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{s.awb ?? "—"}</span>
                        <span className="text-sm text-primary">{s.client_name ?? "—"}</span>
                        <span className="text-xs text-warning">
                          Attempt {s.ndr_attempt_count ?? 0} of {maxAttempts} ({s.carrier_name})
                        </span>
                      </div>
                      <div className="text-xs text-muted font-mono mt-0.5">
                        {s.destination_address_line ?? "—"}, {s.destination_city ?? "—"} ({s.destination_pincode})
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        disabled={busyRow === s.id || atLimit}
                        onClick={() => handleReattempt(s.id)}
                        className="text-xs px-2 py-1 rounded border border-border text-secondary hover:text-primary hover:border-accent disabled:opacity-50"
                        title={atLimit ? "Reattempt limit reached — convert to RTO" : undefined}
                      >
                        Request Reattempt
                      </button>
                      <button
                        onClick={() => {
                          setExpandedRow(expandedRow === s.id ? null : s.id);
                          setAddressLine(s.destination_address_line ?? "");
                          setCity(s.destination_city ?? "");
                        }}
                        className="text-xs px-2 py-1 rounded border border-border text-secondary hover:text-primary hover:border-accent"
                      >
                        Edit Address
                      </button>
                      <button
                        onClick={() => setExpandedRow(expandedRow === `${s.id}-contact` ? null : `${s.id}-contact`)}
                        className="text-xs px-2 py-1 rounded border border-border text-secondary hover:text-primary hover:border-accent"
                      >
                        Contact Customer
                      </button>
                      <button
                        disabled={busyRow === s.id}
                        onClick={() => handleConvertToRto(s.id)}
                        className="text-xs px-2 py-1 rounded border border-danger/40 text-danger hover:bg-danger/10 disabled:opacity-50"
                      >
                        Convert to RTO
                      </button>
                    </div>
                  </div>

                  {expandedRow === s.id && (
                    <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-3">
                      <input
                        value={addressLine}
                        onChange={(e) => setAddressLine(e.target.value)}
                        placeholder="Address line"
                        className={inputClass}
                      />
                      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className={inputClass} />
                      <button
                        disabled={busyRow === s.id}
                        onClick={() => handleSaveAddress(s.id)}
                        className="col-span-2 text-xs px-3 py-1.5 rounded bg-accent text-accent-fg hover:opacity-90 disabled:opacity-50 self-start"
                      >
                        Save address
                      </button>
                    </div>
                  )}

                  {expandedRow === `${s.id}-contact` && (
                    <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notes from the customer call/message"
                        className={`${inputClass} h-20`}
                      />
                      <button
                        disabled={busyRow === s.id}
                        onClick={() => handleContact(s.id)}
                        className="text-xs px-3 py-1.5 rounded bg-accent text-accent-fg hover:opacity-90 disabled:opacity-50 self-start"
                      >
                        Log contact
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
