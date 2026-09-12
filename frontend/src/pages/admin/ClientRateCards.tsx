import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "../../components/layout/AppLayout";
import { useClients, useZones } from "../../hooks/useReferenceData";
import {
  fetchClientRateCards,
  submitClientRateCardVersion,
  type ClientRateCard,
  type SlabKey,
} from "../../api/backend";

const inputClass =
  "bg-surface2 border border-border rounded px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-accent w-full";
const labelClass = "text-xs text-secondary mb-1 block";

const SLABS: { key: SlabKey; label: string }[] = [
  { key: "flat_0_250", label: "0–250g" },
  { key: "flat_upto_500", label: "250–500g" },
  { key: "flat_upto_5000", label: "500g–5kg" },
  { key: "flat_upto_10000", label: "5kg–10kg" },
  { key: "additional_500g_500_to_5000", label: "+500g (500g–5kg band)" },
  { key: "additional_1kg_5000_to_10000", label: "+1kg (5–10kg band)" },
  { key: "additional_1kg_beyond_10000", label: "+1kg (beyond 10kg)" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ClientRateCards() {
  const { data: clients } = useClients();
  const { data: zones } = useZones();
  const [clientId, setClientId] = useState("");
  const [rateCards, setRateCards] = useState<ClientRateCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("Standard");
  const [fuelSurchargePercent, setFuelSurchargePercent] = useState("0");
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [prices, setPrices] = useState<Record<string, string>>({});

  function loadRateCards(id: string) {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchClientRateCards(id)
      .then((res) => {
        setRateCards(res.rateCards);
        const current = res.rateCards.find((rc) => !rc.effective_to && rc.active) ?? res.rateCards[0];
        setName(current?.name ?? "Standard");
        setFuelSurchargePercent(String(current?.fuel_surcharge_percent ?? 0));
        const seeded: Record<string, string> = {};
        for (const sp of current?.slab_prices ?? []) {
          seeded[`${sp.slab_key}:${sp.zone_code}`] = String(sp.price_rupees);
        }
        setPrices(seeded);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (clientId) loadRateCards(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const zoneCodes = useMemo(() => zones?.map((z) => z.zone_code) ?? [], [zones]);

  async function handleSubmit() {
    if (!clientId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const slabPrices = SLABS.flatMap(({ key }) =>
        zoneCodes.map((zoneCode) => ({
          slabKey: key,
          zoneCode,
          priceRupees: parseFloat(prices[`${key}:${zoneCode}`] ?? "0") || 0,
        })),
      );
      await submitClientRateCardVersion({
        clientId,
        name,
        fuelSurchargePercent: parseFloat(fuelSurchargePercent) || 0,
        effectiveFrom,
        slabPrices,
      });
      setSuccess("New client rate card version published.");
      loadRateCards(clientId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout title="Client Rate Cards">
      <div className="flex flex-col gap-6 max-w-5xl">
        <div className="bg-surface border border-border rounded p-4">
          <label className={labelClass}>Client</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={`${inputClass} max-w-xs`}>
            <option value="" disabled>
              Select client
            </option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted mt-2">
            A client with no rate card here gets no <code>client_billed_amount</code> on new shipments — billing
            for them stays deferred until one is published.
          </p>
        </div>

        {clientId && (
          <>
            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-border text-sm font-medium text-secondary">Version history</div>
              {loading ? (
                <div className="p-4 text-sm text-muted">Loading…</div>
              ) : !rateCards || rateCards.length === 0 ? (
                <div className="p-4 text-sm text-muted">No rate card published yet for this client.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-surface2 text-xs text-secondary uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-left px-3 py-2">Fuel surcharge</th>
                      <th className="text-left px-3 py-2">Effective from</th>
                      <th className="text-left px-3 py-2">Effective to</th>
                      <th className="text-left px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateCards.map((rc) => (
                      <tr key={rc.id} className="border-t border-border">
                        <td className="px-3 py-2">{rc.name}</td>
                        <td className="px-3 py-2 tabular-num">{rc.fuel_surcharge_percent}%</td>
                        <td className="px-3 py-2 font-mono text-xs">{rc.effective_from}</td>
                        <td className="px-3 py-2 font-mono text-xs">{rc.effective_to ?? "—"}</td>
                        <td className="px-3 py-2">
                          {!rc.effective_to && rc.active ? (
                            <span className="text-xs text-success">Current</span>
                          ) : (
                            <span className="text-xs text-muted">Historical</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-surface border border-border rounded p-4 flex flex-col gap-4">
              <div className="text-sm font-medium text-secondary">
                Publish new version — closes the current version and opens this one, effective from the date
                below. Prices are pre-filled from the current version; edit only what changed.
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Fuel surcharge (%)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={fuelSurchargePercent}
                    onChange={(e) => setFuelSurchargePercent(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Effective from</label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="overflow-auto border border-border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-surface2 text-xs text-secondary uppercase">
                    <tr>
                      <th className="text-left px-3 py-2 whitespace-nowrap">Slab</th>
                      {zoneCodes.map((zc) => (
                        <th key={zc} className="text-left px-3 py-2 whitespace-nowrap">
                          Zone {zc}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SLABS.map(({ key, label }) => (
                      <tr key={key} className="border-t border-border">
                        <td className="px-3 py-2 text-xs text-secondary whitespace-nowrap">{label}</td>
                        {zoneCodes.map((zc) => (
                          <td key={zc} className="px-2 py-1.5">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={prices[`${key}:${zc}`] ?? ""}
                              onChange={(e) => setPrices((p) => ({ ...p, [`${key}:${zc}`]: e.target.value }))}
                              className={`${inputClass} w-24`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}
              {success && (
                <div className="text-xs text-success bg-success/10 border border-success/30 rounded px-2 py-1.5">{success}</div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-accent text-accent-fg rounded py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 self-start px-6"
              >
                {submitting ? "Publishing..." : "Publish new version"}
              </button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
