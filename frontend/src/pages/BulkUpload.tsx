import { useEffect, useState } from "react";
import Papa from "papaparse";
import { AppLayout } from "../components/layout/AppLayout";
import { CsvColumnMapper, type RequiredField } from "../components/common/CsvColumnMapper";
import {
  bulkUploadShipments,
  checkServiceabilityBulk,
  type BulkUploadRowResult,
  type CreateShipmentInput,
} from "../api/backend";

const IMPORTER_KEY = "bulk-upload";
const REQUIRED_FIELDS: RequiredField[] = [
  { key: "orderId", label: "Order ID" },
  { key: "clientId", label: "Client ID" },
  { key: "clientName", label: "Client name" },
  { key: "addressLine", label: "Delivery address" },
  { key: "city", label: "City" },
  { key: "carrierCode", label: "Carrier code" },
  { key: "originPincode", label: "Origin pincode" },
  { key: "destinationPincode", label: "Destination pincode" },
  { key: "weightGrams", label: "Weight (grams)" },
  { key: "lengthCm", label: "Length (cm)" },
  { key: "widthCm", label: "Width (cm)" },
  { key: "heightCm", label: "Height (cm)" },
  { key: "paymentMode", label: "Payment mode (COD/Prepaid)" },
  { key: "shipmentValueRupees", label: "Shipment value (₹)" },
];

function parseRow(raw: Record<string, string | undefined>): CreateShipmentInput {
  return {
    orderId: raw.orderId ?? "",
    clientId: raw.clientId ?? "",
    clientName: raw.clientName ?? "",
    addressLine: raw.addressLine ?? "",
    city: raw.city ?? "",
    carrierCode: raw.carrierCode || "delhivery",
    originPincode: raw.originPincode ?? "",
    destinationPincode: raw.destinationPincode ?? "",
    weightGrams: parseFloat(raw.weightGrams ?? ""),
    dimensions: {
      lengthCm: parseFloat(raw.lengthCm ?? ""),
      widthCm: parseFloat(raw.widthCm ?? ""),
      heightCm: parseFloat(raw.heightCm ?? ""),
    },
    paymentMode: raw.paymentMode === "COD" ? "COD" : "Prepaid",
    shipmentValueRupees: parseFloat(raw.shipmentValueRupees ?? "") || 0,
  };
}

export function BulkUpload() {
  const [rawRows, setRawRows] = useState<Record<string, string | undefined>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapped, setMapped] = useState(false);
  const [rows, setRows] = useState<CreateShipmentInput[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<BulkUploadRowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [checkingServiceability, setCheckingServiceability] = useState(false);
  const [nonServiceablePincodes, setNonServiceablePincodes] = useState<Set<string>>(new Set());

  function handleFile(file: File) {
    setFileName(file.name);
    setResults(null);
    setError(null);
    setMapped(false);
    setRows([]);
    setNonServiceablePincodes(new Set());
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setRawRows(result.data);
        setCsvHeaders(result.meta.fields ?? []);
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

  // Pre-flight every parsed row's destination pincode before allowing
  // upload, instead of only discovering non-serviceable ones after the fact
  // in the per-row results.
  useEffect(() => {
    if (rows.length === 0) return;
    let cancelled = false;
    setCheckingServiceability(true);
    const uniquePincodes = [...new Set(rows.map((r) => r.destinationPincode).filter(Boolean))];
    checkServiceabilityBulk(uniquePincodes)
      .then((response) => {
        if (cancelled) return;
        setNonServiceablePincodes(
          new Set(response.results.filter((r) => !r.serviceable).map((r) => r.pincode)),
        );
      })
      .catch(() => {
        if (!cancelled) setNonServiceablePincodes(new Set());
      })
      .finally(() => {
        if (!cancelled) setCheckingServiceability(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const nonServiceableRowCount = rows.filter((r) => nonServiceablePincodes.has(r.destinationPincode)).length;

  async function handleUpload() {
    setUploading(true);
    setError(null);
    try {
      const response = await bulkUploadShipments(rows);
      setResults(response.results);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppLayout title="Bulk Upload">
      <div className="max-w-3xl flex flex-col gap-4">
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

        {mapped && rows.length > 0 && !results && (
          <div className="bg-surface border border-border rounded p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary">
                {rows.length} rows parsed and ready to upload.
                {checkingServiceability && " Checking serviceability…"}
              </span>
              <button
                onClick={handleUpload}
                disabled={uploading || checkingServiceability}
                className="bg-accent text-accent-fg rounded py-1.5 px-4 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload shipments"}
              </button>
            </div>
            {nonServiceableRowCount > 0 && (
              <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded px-2 py-1.5">
                {nonServiceableRowCount} row(s) have a non-serviceable destination pincode ({[...nonServiceablePincodes].join(", ")}) —
                these will fail booking. Fix them before uploading, or proceed and review the per-row results.
              </div>
            )}
          </div>
        )}

        {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}

        {results && (
          <div className="bg-surface border border-border rounded overflow-hidden">
            <div className="p-4 border-b border-border text-sm text-secondary">
              {results.filter((r) => r.success).length} succeeded, {results.filter((r) => !r.success).length} failed
              out of {results.length}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-surface2 text-xs text-secondary uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Order ID</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">AWB / Error</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.orderId} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{r.orderId}</td>
                    <td className="px-3 py-2">
                      {r.success ? (
                        <span className="text-success">Success</span>
                      ) : (
                        <span className="text-danger">Failed</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-secondary">{r.awb ?? r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
