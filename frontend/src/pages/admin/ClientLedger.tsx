import { useEffect, useState } from "react";
import { AppLayout } from "../../components/layout/AppLayout";
import { useClients } from "../../hooks/useReferenceData";
import { exportToExcel } from "../../lib/excel-export";
import {
  fetchClientLedgerEntries,
  fetchClientLedgerSummaries,
  fetchSettlementRuns,
  recordClientPayment,
  remitCodToClient,
  settlePeriod,
  type ClientLedgerEntry,
  type ClientLedgerSummary,
  type ClientSettlementRun,
} from "../../api/backend";
import { StagingBanner } from "../../components/common/StagingBanner";

const inputClass =
  "bg-surface2 border border-border rounded px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-accent w-full";
const labelClass = "text-xs text-secondary mb-1 block";

function formatRupees(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}₹${Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

interface RunningEntry extends ClientLedgerEntry {
  freightBalance: number;
  codBalance: number;
  netBalance: number;
}

function withRunningBalances(entries: ClientLedgerEntry[]): RunningEntry[] {
  let freightBalance = 0;
  let codBalance = 0;
  return entries.map((e) => {
    if (e.entry_type === "freight_debit") freightBalance += Number(e.amount_rupees);
    if (e.entry_type === "freight_credit") freightBalance -= Number(e.amount_rupees);
    if (e.entry_type === "cod_credit") codBalance += Number(e.amount_rupees);
    if (e.entry_type === "cod_debit") codBalance -= Number(e.amount_rupees);
    return { ...e, freightBalance, codBalance, netBalance: codBalance - freightBalance };
  });
}

const ENTRY_TYPE_LABELS: Record<ClientLedgerEntry["entry_type"], string> = {
  freight_debit: "Invoice raised",
  freight_credit: "Payment received",
  cod_credit: "COD collected",
  cod_debit: "COD remitted",
};

export function ClientLedger() {
  const { data: clients } = useClients();
  const [summaries, setSummaries] = useState<ClientLedgerSummary[] | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [clientId, setClientId] = useState("");
  const [entries, setEntries] = useState<ClientLedgerEntry[] | null>(null);
  const [settlementRuns, setSettlementRuns] = useState<ClientSettlementRun[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentReference, setPaymentReference] = useState("");

  const [codAmount, setCodAmount] = useState("");
  const [codReference, setCodReference] = useState("");

  const [settlePeriodFrom, setSettlePeriodFrom] = useState(firstOfMonth());
  const [settlePeriodTo, setSettlePeriodTo] = useState(today());

  function loadSummaries() {
    setSummaryLoading(true);
    fetchClientLedgerSummaries()
      .then((res) => setSummaries(res.summaries))
      .catch((err) => setError((err as Error).message))
      .finally(() => setSummaryLoading(false));
  }

  useEffect(loadSummaries, []);

  function loadDetail(id: string) {
    if (!id) return;
    setDetailLoading(true);
    Promise.all([fetchClientLedgerEntries(id), fetchSettlementRuns(id)])
      .then(([entriesRes, runsRes]) => {
        setEntries(entriesRes.entries);
        setSettlementRuns(runsRes.settlementRuns);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setDetailLoading(false));
  }

  useEffect(() => {
    if (clientId) loadDetail(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  function refreshAll() {
    loadSummaries();
    if (clientId) loadDetail(clientId);
  }

  const selectedClient = clients?.find((c) => c.id === clientId);
  const runningEntries = entries ? withRunningBalances(entries) : [];
  const latest = runningEntries[runningEntries.length - 1];

  async function handleRecordPayment() {
    if (!clientId || !paymentAmount) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await recordClientPayment(clientId, parseFloat(paymentAmount), paymentDate, paymentReference || undefined);
      setSuccess("Payment recorded.");
      setPaymentAmount("");
      setPaymentReference("");
      refreshAll();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemitCod() {
    if (!clientId || !codAmount) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await remitCodToClient(clientId, parseFloat(codAmount), codReference || undefined);
      setSuccess("COD remittance recorded.");
      setCodAmount("");
      setCodReference("");
      refreshAll();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSettlePeriod() {
    if (!clientId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await settlePeriod(clientId, settlePeriodFrom, settlePeriodTo);
      const net = result.settlementRun.net_amount_rupees;
      setSuccess(
        net >= 0
          ? `Period settled — Time Bound owes the client ${formatRupees(net)}.`
          : `Period settled — the client owes Time Bound ${formatRupees(-net)}.`,
      );
      refreshAll();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleExportSummary() {
    if (!summaries) return;
    exportToExcel("client-ledger-summary.xlsx", [
      {
        name: "Summary",
        rows: summaries.map((s) => ({
          Client: s.clientName,
          "Settlement Mode": s.settlementMode,
          "Freight Receivable": s.freightBalanceRupees,
          "COD Payable": s.codBalanceRupees,
          "Net Position": s.netBalanceRupees,
        })),
      },
    ]);
  }

  function handleExportLedger() {
    if (!selectedClient || runningEntries.length === 0) return;
    exportToExcel(`${selectedClient.name.replace(/\s+/g, "-")}-ledger.xlsx`, [
      {
        name: "Ledger",
        rows: runningEntries.map((e) => ({
          Date: e.created_at,
          Type: ENTRY_TYPE_LABELS[e.entry_type],
          Description: e.description,
          Amount: e.amount_rupees,
          "Freight Balance": e.freightBalance,
          "COD Balance": e.codBalance,
          "Net Balance": e.netBalance,
        })),
      },
    ]);
  }

  return (
    <AppLayout title="Client Ledger">
      <div className="flex flex-col gap-6 max-w-6xl">
        <StagingBanner feature="clientLedger" />
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-medium text-secondary">
              Cross-client summary — who owes what at a glance
            </span>
            <button
              onClick={handleExportSummary}
              disabled={!summaries || summaries.length === 0}
              className="text-xs px-3 py-1.5 rounded border border-border text-secondary hover:text-primary hover:border-accent disabled:opacity-50"
            >
              Export to Excel
            </button>
          </div>
          {summaryLoading ? (
            <div className="p-4 text-sm text-muted">Loading…</div>
          ) : !summaries || summaries.length === 0 ? (
            <div className="p-4 text-sm text-muted">No clients yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface2 text-xs text-secondary uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Client</th>
                  <th className="text-left px-3 py-2">Mode</th>
                  <th className="text-left px-3 py-2">Freight receivable</th>
                  <th className="text-left px-3 py-2">COD payable</th>
                  <th className="text-left px-3 py-2">Net position</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr
                    key={s.clientId}
                    onClick={() => setClientId(s.clientId)}
                    className="border-t border-border hover:bg-surface2/60 cursor-pointer"
                  >
                    <td className="px-3 py-2">{s.clientName}</td>
                    <td className="px-3 py-2 text-xs text-muted capitalize">{s.settlementMode}</td>
                    <td className="px-3 py-2 tabular-num">{formatRupees(s.freightBalanceRupees)}</td>
                    <td className="px-3 py-2 tabular-num">{formatRupees(s.codBalanceRupees)}</td>
                    <td className={`px-3 py-2 tabular-num font-medium ${s.netBalanceRupees >= 0 ? "text-success" : "text-danger"}`}>
                      {formatRupees(s.netBalanceRupees)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-surface border border-border rounded p-4">
          <label className={labelClass}>View client ledger</label>
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
        </div>

        {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}
        {success && (
          <div className="text-xs text-success bg-success/10 border border-success/30 rounded px-2 py-1.5">{success}</div>
        )}

        {clientId && selectedClient && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {selectedClient.settlement_mode === "netted" ? (
                <div className="bg-surface border border-border rounded p-4 flex flex-col gap-3">
                  <div className="text-sm font-medium text-secondary">
                    Settle period (netted client — freight offset against COD)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>From</label>
                      <input type="date" value={settlePeriodFrom} onChange={(e) => setSettlePeriodFrom(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>To</label>
                      <input type="date" value={settlePeriodTo} onChange={(e) => setSettlePeriodTo(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <button
                    onClick={handleSettlePeriod}
                    disabled={submitting}
                    className="text-sm px-4 py-1.5 rounded bg-accent text-accent-fg hover:opacity-90 disabled:opacity-50 self-start"
                  >
                    Settle period
                  </button>
                </div>
              ) : (
                <div className="bg-surface border border-border rounded p-4 flex flex-col gap-3">
                  <div className="text-sm font-medium text-secondary">Remit COD to client (separate settlement)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Amount (₹)</label>
                      <input type="number" step="0.01" min="0" value={codAmount} onChange={(e) => setCodAmount(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Reference</label>
                      <input value={codReference} onChange={(e) => setCodReference(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <button
                    onClick={handleRemitCod}
                    disabled={submitting || !codAmount}
                    className="text-sm px-4 py-1.5 rounded bg-accent text-accent-fg hover:opacity-90 disabled:opacity-50 self-start"
                  >
                    Remit COD
                  </button>
                </div>
              )}

              <div className="bg-surface border border-border rounded p-4 flex flex-col gap-3">
                <div className="text-sm font-medium text-secondary">Record freight payment received</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Amount (₹)</label>
                    <input type="number" step="0.01" min="0" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Date</label>
                    <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Reference</label>
                    <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <button
                  onClick={handleRecordPayment}
                  disabled={submitting || !paymentAmount}
                  className="text-sm px-4 py-1.5 rounded bg-accent text-accent-fg hover:opacity-90 disabled:opacity-50 self-start"
                >
                  Record payment
                </button>
              </div>
            </div>

            {latest && (
              <div className="flex gap-4 text-sm">
                {selectedClient.settlement_mode === "netted" ? (
                  <div className="bg-surface border border-border rounded px-4 py-3">
                    <span className="text-xs text-muted block">Net position (positive = Time Bound owes client)</span>
                    <span className={`text-lg font-semibold tabular-num ${latest.netBalance >= 0 ? "text-success" : "text-danger"}`}>
                      {formatRupees(latest.netBalance)}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="bg-surface border border-border rounded px-4 py-3">
                      <span className="text-xs text-muted block">Freight receivable</span>
                      <span className="text-lg font-semibold tabular-num">{formatRupees(latest.freightBalance)}</span>
                    </div>
                    <div className="bg-surface border border-border rounded px-4 py-3">
                      <span className="text-xs text-muted block">COD payable</span>
                      <span className="text-lg font-semibold tabular-num">{formatRupees(latest.codBalance)}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-medium text-secondary">Chronological ledger</span>
                <button
                  onClick={handleExportLedger}
                  disabled={runningEntries.length === 0}
                  className="text-xs px-3 py-1.5 rounded border border-border text-secondary hover:text-primary hover:border-accent disabled:opacity-50"
                >
                  Export to Excel
                </button>
              </div>
              {detailLoading ? (
                <div className="p-4 text-sm text-muted">Loading…</div>
              ) : runningEntries.length === 0 ? (
                <div className="p-4 text-sm text-muted">No ledger entries yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-surface2 text-xs text-secondary uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Type</th>
                      <th className="text-left px-3 py-2">Description</th>
                      <th className="text-left px-3 py-2">Amount</th>
                      {selectedClient.settlement_mode === "netted" ? (
                        <th className="text-left px-3 py-2">Net balance</th>
                      ) : (
                        <>
                          <th className="text-left px-3 py-2">Freight balance</th>
                          <th className="text-left px-3 py-2">COD balance</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {runningEntries.map((e) => (
                      <tr key={e.id} className="border-t border-border">
                        <td className="px-3 py-2 text-xs text-secondary whitespace-nowrap">
                          {new Date(e.created_at).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">{ENTRY_TYPE_LABELS[e.entry_type]}</td>
                        <td className="px-3 py-2 text-xs text-secondary">{e.description}</td>
                        <td className="px-3 py-2 tabular-num">{formatRupees(Number(e.amount_rupees))}</td>
                        {selectedClient.settlement_mode === "netted" ? (
                          <td className="px-3 py-2 tabular-num">{formatRupees(e.netBalance)}</td>
                        ) : (
                          <>
                            <td className="px-3 py-2 tabular-num">{formatRupees(e.freightBalance)}</td>
                            <td className="px-3 py-2 tabular-num">{formatRupees(e.codBalance)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {settlementRuns && settlementRuns.length > 0 && (
              <div className="bg-surface border border-border rounded overflow-hidden">
                <div className="px-4 py-3 border-b border-border text-sm font-medium text-secondary">
                  Settlement run history
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-surface2 text-xs text-secondary uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Period</th>
                      <th className="text-left px-3 py-2">Freight total</th>
                      <th className="text-left px-3 py-2">COD total</th>
                      <th className="text-left px-3 py-2">Net (paid to client)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlementRuns.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-xs">
                          {r.period_from} → {r.period_to}
                        </td>
                        <td className="px-3 py-2 tabular-num">{formatRupees(r.freight_total_rupees)}</td>
                        <td className="px-3 py-2 tabular-num">{formatRupees(r.cod_total_rupees)}</td>
                        <td className={`px-3 py-2 tabular-num font-medium ${r.net_amount_rupees >= 0 ? "text-success" : "text-danger"}`}>
                          {formatRupees(r.net_amount_rupees)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
