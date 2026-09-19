import { useEffect, useState } from "react";
import { AppLayout } from "../../components/layout/AppLayout";
import { useClients } from "../../hooks/useReferenceData";
import { fetchInvoices, generateInvoice, type ClientInvoice } from "../../api/backend";
import { StagingBanner } from "../../components/common/StagingBanner";
import { FEATURES, isFeatureActionEnabled } from "../../lib/feature-flags";

const inputClass =
  "bg-surface2 border border-border rounded px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-accent w-full";
const labelClass = "text-xs text-secondary mb-1 block";

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatRupees(value: number): string {
  return `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function Invoices() {
  const { data: clients } = useClients();
  const [invoices, setInvoices] = useState<ClientInvoice[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [clientId, setClientId] = useState("");
  const [periodFrom, setPeriodFrom] = useState(firstOfMonth());
  const [periodTo, setPeriodTo] = useState(today());

  function load() {
    setLoading(true);
    fetchInvoices()
      .then((res) => setInvoices(res.invoices))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await generateInvoice(clientId, periodFrom, periodTo);
      setSuccess(`Generated ${result.invoice.invoice_number} — ${formatRupees(result.invoice.total_rupees)}`);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AppLayout title="Invoices">
      <div className="flex flex-col gap-6 max-w-4xl">
        <StagingBanner feature="invoices" />
        <div className="bg-surface border border-border rounded p-4 flex flex-col gap-3">
          <div className="text-sm font-medium text-secondary">Generate invoice</div>
          <p className="text-xs text-muted">
            Draft generation is disabled until Time Bound confirms the GST rate and intra- vs inter-state split.
            Existing invoices (if any) still list below.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Client</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
                <option value="" disabled>
                  Select client
                </option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Period from</label>
              <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Period to</label>
              <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className={inputClass} />
            </div>
          </div>
          {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}
          {success && (
            <div className="text-xs text-success bg-success/10 border border-success/30 rounded px-2 py-1.5">{success}</div>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating || !clientId || !isFeatureActionEnabled("invoices")}
            title={!isFeatureActionEnabled("invoices") ? FEATURES.invoices.reason : undefined}
            className="bg-accent text-accent-fg rounded py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 self-start px-6"
          >
            {generating ? "Generating..." : "Generate invoice"}
          </button>
        </div>

        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-medium text-secondary">Invoices</div>
          {loading ? (
            <div className="p-4 text-sm text-muted">Loading…</div>
          ) : !invoices || invoices.length === 0 ? (
            <div className="p-4 text-sm text-muted">No invoices generated yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface2 text-xs text-secondary uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Number</th>
                  <th className="text-left px-3 py-2">Client</th>
                  <th className="text-left px-3 py-2">Period</th>
                  <th className="text-left px-3 py-2">Subtotal</th>
                  <th className="text-left px-3 py-2">Tax</th>
                  <th className="text-left px-3 py-2">Total</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{inv.invoice_number}</td>
                    <td className="px-3 py-2">{inv.clients?.name ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {inv.period_from} → {inv.period_to}
                    </td>
                    <td className="px-3 py-2 tabular-num">{formatRupees(inv.subtotal_rupees)}</td>
                    <td className="px-3 py-2 tabular-num">{formatRupees(inv.tax_rupees)}</td>
                    <td className="px-3 py-2 tabular-num font-medium">{formatRupees(inv.total_rupees)}</td>
                    <td className="px-3 py-2 text-xs text-muted capitalize">{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
