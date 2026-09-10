import { useState, type FormEvent } from "react";
import { AppLayout } from "../components/layout/AppLayout";
import { calculateRates } from "../api/backend";
import type { PaymentMode, RateQuote } from "../lib/types";

const inputClass =
  "bg-surface2 border border-border rounded px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-accent w-full";
const labelClass = "text-xs text-secondary mb-1 block";

export function RateCalculator() {
  const [originPincode, setOriginPincode] = useState("");
  const [destinationPincode, setDestinationPincode] = useState("");
  const [weightKg, setWeightKg] = useState("1");
  const [length, setLength] = useState("10");
  const [width, setWidth] = useState("10");
  const [height, setHeight] = useState("10");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("Prepaid");
  const [shipmentValue, setShipmentValue] = useState("500");

  const [quotes, setQuotes] = useState<RateQuote[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setQuotes(null);
    try {
      const result = await calculateRates({
        originPincode,
        destinationPincode,
        weightGrams: parseFloat(weightKg) * 1000,
        dimensions: { lengthCm: parseFloat(length), widthCm: parseFloat(width), heightCm: parseFloat(height) },
        paymentMode,
        shipmentValueRupees: parseFloat(shipmentValue) || 0,
      });
      setQuotes(result.quotes);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout title="Rate Calculator">
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Origin pincode</label>
              <input required value={originPincode} onChange={(e) => setOriginPincode(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Destination pincode</label>
              <input required value={destinationPincode} onChange={(e) => setDestinationPincode(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Weight (kg)</label>
            <input required type="number" step="0.01" min="0.01" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>L (cm)</label>
              <input required type="number" step="0.1" min="0.1" value={length} onChange={(e) => setLength(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>W (cm)</label>
              <input required type="number" step="0.1" min="0.1" value={width} onChange={(e) => setWidth(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>H (cm)</label>
              <input required type="number" step="0.1" min="0.1" value={height} onChange={(e) => setHeight(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Payment mode</label>
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)} className={inputClass}>
              <option value="Prepaid">Prepaid</option>
              <option value="COD">COD</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Shipment value (₹)</label>
            <input type="number" step="1" min="0" value={shipmentValue} onChange={(e) => setShipmentValue(e.target.value)} className={inputClass} />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-accent text-accent-fg rounded py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Calculating..." : "Calculate rates"}
          </button>
          {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}
        </form>

        <div className="flex flex-col gap-3">
          {quotes === null && !loading && (
            <div className="text-sm text-muted py-8 text-center border border-dashed border-border rounded">
              Enter shipment details and calculate to see ranked carrier quotes.
            </div>
          )}
          {quotes?.map((q, i) => (
            <div key={q.carrierCode} className="bg-surface border border-border rounded p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-primary">{q.carrierName}</span>
                  {i === 0 && (
                    <span className="text-xs bg-success/15 text-success border border-success/40 rounded-full px-2 py-0.5">
                      Best rate
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted mt-1">
                  Zone <span className="font-mono">{q.zone.zoneCode}</span>
                  {q.zone.source === "computed" && <span className="text-warning"> (estimated zone)</span>}
                  {" · "}
                  {(q.chargeableWeightGrams / 1000).toFixed(2)} kg chargeable
                  {" · "}
                  {q.source === "carrier_api" ? "live API quote" : "fallback rate card"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold tabular-num text-primary">
                  ₹{q.totalCostRupees.toFixed(2)}
                </div>
                {q.codChargeRupees > 0 && (
                  <div className="text-xs text-muted">incl. ₹{q.codChargeRupees.toFixed(2)} COD charge</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
