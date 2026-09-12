import { useState } from "react";
import Papa from "papaparse";
import { AppLayout } from "../../components/layout/AppLayout";
import {
  fetchCarrierRemittanceLines,
  reconcileCarrierRemittance,
  type CarrierRemittanceLine,
  type CarrierRemittanceResult,
} from "../../api/backend";

const EXPECTED_COLUMNS = ["awb", "remittedAmountRupees"];

interface ParsedRow {
  awb: string;
  remittedAmountRupees: number;
}

function parseRow(raw: Record<string, string | undefined>): ParsedRow {
  return {
    awb: raw.awb ?? "",
    remittedAmountRupees: parseFloat(raw.remittedAmountRupees ?? "") || 0,
  };
}

const STATUS_CLASSES: Record<CarrierRemittanceLine["status"], string> = {
  matched: "text-success",
  unmatched: "text-warning",
};

export function CarrierRemittance() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<CarrierRemittanceResult | null>(null);
  const [lines, setLines] = useState<CarrierRemittanceLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setLines(null);
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => setRows(parsed.data.map(parseRow)),
      error: (err) => setError(err.message),
    });
  }

  async function handleUpload() {
    setUploading(true);
    setError(null);
    try {
      const response = await reconcileCarrierRemittance("delhivery", rows, fileName ?? undefined);
      setResult(response);
      const linesResponse = await fetchCarrierRemittanceLines(response.batchId);
      setLines(linesResponse.lines);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppLayout title="Carrier COD Remittance">
      <div className="max-w-3xl flex flex-col gap-4">
        <div className="bg-surface border border-border rounded p-4 text-sm text-secondary">
          <p className="mb-2">
            Upload the carrier's COD remittance report — the cash they've collected from customers and paid out to
            Time Bound. A match flips the shipment's COD status to "collected" and credits the client's ledger for
            that amount, ready to be netted or remitted onward.
          </p>
          <p className="mb-2">CSV columns expected (header row required):</p>
          <code className="block text-xs bg-surface2 rounded p-2 font-mono overflow-x-auto whitespace-pre">
            {EXPECTED_COLUMNS.join(",")}
          </code>
        </div>

        <div className="bg-surface border border-border rounded p-4 flex items-center gap-4">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="text-sm text-secondary"
          />
          {fileName && <span className="text-xs text-muted">{fileName}</span>}
        </div>

        {rows.length > 0 && !result && (
          <div className="bg-surface border border-border rounded p-4 flex items-center justify-between">
            <span className="text-sm text-secondary">{rows.length} rows parsed and ready to reconcile.</span>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="bg-accent text-accent-fg rounded py-1.5 px-4 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? "Reconciling..." : "Reconcile"}
            </button>
          </div>
        )}

        {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}

        {result && (
          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="p-4 border-b border-border text-sm text-secondary">
              {result.matched} matched, {result.totalLines - result.matched} unmatched out of {result.totalLines}
            </div>
            {lines && (
              <table className="w-full text-sm">
                <thead className="bg-surface2 text-xs text-secondary uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">AWB</th>
                    <th className="text-left px-3 py-2">Remitted</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{l.awb}</td>
                      <td className="px-3 py-2 tabular-num">₹{l.remitted_amount_rupees.toFixed(2)}</td>
                      <td className={`px-3 py-2 ${STATUS_CLASSES[l.status]}`}>{l.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
