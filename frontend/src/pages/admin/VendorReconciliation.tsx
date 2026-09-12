import { useState } from "react";
import Papa from "papaparse";
import { AppLayout } from "../../components/layout/AppLayout";
import { CsvColumnMapper, type RequiredField } from "../../components/common/CsvColumnMapper";
import {
  fetchVendorInvoiceLines,
  reconcileVendorInvoice,
  type VendorInvoiceLine,
  type VendorReconciliationResult,
} from "../../api/backend";

const IMPORTER_KEY = "vendor-reconciliation";
const REQUIRED_FIELDS: RequiredField[] = [
  { key: "awb", label: "AWB" },
  { key: "vendorBilledAmountRupees", label: "Vendor billed amount (₹)" },
];

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
  const [rawRows, setRawRows] = useState<Record<string, string | undefined>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapped, setMapped] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<VendorReconciliationResult | null>(null);
  const [lines, setLines] = useState<VendorInvoiceLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setLines(null);
    setMapped(false);
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        setRawRows(parsed.data);
        setCsvHeaders(parsed.meta.fields ?? []);
      },
      error: (err) => setError(err.message),
    });
  }

  function handleMappingConfirmed(mapping: Record<string, string>) {
    const remapped = rawRows.map((raw) => {
      const mappedRow: Record<string, string | undefined> = {};
      for (const field of REQUIRED_FIELDS) mappedRow[field.key] = raw[mapping[field.key] ?? ""];
      return mappedRow;
    });
    setRows(remapped.map(parseRow));
    setMapped(true);
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
          <p>
            Upload the vendor's invoice CSV to compare what they billed against the expected amount recomputed
            from the rate card version active at booking time (accounting for any recorded weight discrepancy).
          </p>
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

        {csvHeaders.length > 0 && !mapped && (
          <CsvColumnMapper
            importerKey={IMPORTER_KEY}
            csvHeaders={csvHeaders}
            requiredFields={REQUIRED_FIELDS}
            onConfirm={handleMappingConfirmed}
          />
        )}

        {mapped && rows.length > 0 && !result && (
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
