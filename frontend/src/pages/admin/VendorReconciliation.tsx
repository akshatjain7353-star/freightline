import { useState } from "react";
import Papa from "papaparse";
import { AppLayout } from "../../components/layout/AppLayout";
import {
  fetchVendorInvoiceLines,
  reconcileVendorInvoice,
  type VendorInvoiceLine,
  type VendorReconciliationResult,
} from "../../api/backend";

const EXPECTED_COLUMNS = ["awb", "vendorBilledAmountRupees"];

interface ParsedRow {
  awb: string;
  vendorBilledAmountRupees: number;
}

function parseRow(raw: Record<string, string | undefined>): ParsedRow {
  return {
    awb: raw.awb ?? "",
    vendorBilledAmountRupees: parseFloat(raw.vendorBilledAmountRupees ?? "") || 0,
  };
}

const STATUS_CLASSES: Record<VendorInvoiceLine["status"], string> = {
  matched: "text-success",
  discrepancy: "text-danger",
  unmatched: "text-warning",
};

export function VendorReconciliation() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<VendorReconciliationResult | null>(null);
  const [lines, setLines] = useState<VendorInvoiceLine[] | null>(null);
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
      const response = await reconcileVendorInvoice("delhivery", rows, fileName ?? undefined);
      setResult(response);
      const linesResponse = await fetchVendorInvoiceLines(response.batchId);
      setLines(linesResponse.lines);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppLayout title="Vendor Reconciliation">
      <div className="max-w-3xl flex flex-col gap-4">
        <div className="bg-surface border border-border rounded p-4 text-sm text-secondary">
          <p className="mb-2">
            Upload the vendor's invoice CSV to compare what they billed against the expected amount recomputed
            from the rate card version active at booking time (accounting for any recorded weight discrepancy).
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
              {result.matched} matched, {result.discrepancy} discrepancy, {result.totalLines - result.matched - result.discrepancy}{" "}
              unmatched out of {result.totalLines}
            </div>
            {lines && (
              <table className="w-full text-sm">
                <thead className="bg-surface2 text-xs text-secondary uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">AWB</th>
                    <th className="text-left px-3 py-2">Vendor billed</th>
                    <th className="text-left px-3 py-2">Expected</th>
                    <th className="text-left px-3 py-2">Delta</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-xs">{l.awb}</td>
                      <td className="px-3 py-2 tabular-num">₹{l.vendor_billed_amount_rupees.toFixed(2)}</td>
                      <td className="px-3 py-2 tabular-num">
                        {l.expected_amount_rupees !== null ? `₹${l.expected_amount_rupees.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 tabular-num">
                        {l.discrepancy_rupees !== null ? `₹${l.discrepancy_rupees.toFixed(2)}` : "—"}
                      </td>
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
