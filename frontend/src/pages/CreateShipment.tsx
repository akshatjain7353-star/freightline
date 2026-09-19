import { useState, type FormEvent } from "react";
import { AppLayout } from "../components/layout/AppLayout";
import { Link } from "react-router-dom";
import { checkServiceability, createShipment } from "../api/backend";
import { useCarriers, useClients } from "../hooks/useReferenceData";
import { useCapabilities } from "../hooks/useCapabilities";
import { isValidPincode, PINCODE_PATTERN } from "../lib/validation";
import type { PaymentMode } from "../lib/types";

const inputClass =
  "bg-surface2 border border-border rounded px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-accent w-full";
const labelClass = "text-xs text-secondary mb-1 block";

export function CreateShipment() {
  const { data: clients } = useClients();
  const { data: carriers } = useCarriers();
  const { data: capabilities } = useCapabilities();
  const manualBooking = capabilities?.manualBookingEnabled ?? false;

  const [orderId, setOrderId] = useState("");
  const [clientId, setClientId] = useState("");
  const [carrierCode, setCarrierCode] = useState("delhivery");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [originPincode, setOriginPincode] = useState("");
  const [destinationPincode, setDestinationPincode] = useState("");
  const [weightKg, setWeightKg] = useState("1");
  const [length, setLength] = useState("10");
  const [width, setWidth] = useState("10");
  const [height, setHeight] = useState("10");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("Prepaid");
  const [shipmentValue, setShipmentValue] = useState("500");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ text: string; shipmentId?: string } | null>(null);

  const [serviceability, setServiceability] = useState<
    "idle" | "checking" | "serviceable" | "non_serviceable" | "skipped"
  >("idle");

  async function handlePincodeBlur() {
    if (!isValidPincode(destinationPincode)) {
      setServiceability("idle");
      return;
    }
    setServiceability("checking");
    try {
      const result = await checkServiceability(destinationPincode, carrierCode);
      if (result.raw?.skipped) {
        setServiceability("skipped");
      } else {
        setServiceability(result.serviceable ? "serviceable" : "non_serviceable");
      }
    } catch {
      // Fail open on the pre-check itself — the hard backstop on the server
      // (NonServiceableError) still catches this at actual booking time.
      setServiceability("idle");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const client = clients?.find((c) => c.id === clientId);
    try {
      const result = await createShipment({
        orderId,
        clientId,
        clientName: client?.name ?? "",
        addressLine,
        city,
        carrierCode,
        originPincode,
        destinationPincode,
        weightGrams: parseFloat(weightKg) * 1000,
        dimensions: { lengthCm: parseFloat(length), widthCm: parseFloat(width), heightCm: parseFloat(height) },
        paymentMode,
        shipmentValueRupees: parseFloat(shipmentValue) || 0,
      });
      if (result.shipment.awb) {
        setSuccess({ text: `Shipment booked. AWB: ${result.shipment.awb}`, shipmentId: result.shipment.id });
      } else {
        setSuccess({
          text: "Local shipment saved (no AWB). Add DELHIVERY_API_KEY to enable live carrier booking.",
          shipmentId: result.shipment.id,
        });
      }
      setOrderId("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout title="Create Shipment">
      {manualBooking && (
        <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded px-3 py-2 mb-4 max-w-2xl">
          Delhivery is not configured. Booking will save a local shipment without an AWB so ops can still
          track orders in this console. Set <span className="font-mono">DELHIVERY_API_KEY</span> on the
          backend to enable live booking.
        </div>
      )}
      <form onSubmit={handleSubmit} className="max-w-2xl bg-surface border border-border rounded p-5 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Order ID</label>
            <input required value={orderId} onChange={(e) => setOrderId(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Client</label>
            <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
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
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Delivery address</label>
            <input required value={addressLine} onChange={(e) => setAddressLine(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input required value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Carrier</label>
            <select value={carrierCode} onChange={(e) => setCarrierCode(e.target.value)} className={inputClass}>
              {carriers?.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Origin pincode</label>
            <input
              required
              inputMode="numeric"
              pattern={PINCODE_PATTERN}
              maxLength={6}
              title="6-digit Indian PIN"
              value={originPincode}
              onChange={(e) => setOriginPincode(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Destination pincode</label>
            <input
              required
              inputMode="numeric"
              pattern={PINCODE_PATTERN}
              maxLength={6}
              title="6-digit Indian PIN"
              value={destinationPincode}
              onChange={(e) => {
                setDestinationPincode(e.target.value);
                setServiceability("idle");
              }}
              onBlur={handlePincodeBlur}
              className={inputClass}
            />
            {serviceability === "checking" && <div className="text-xs text-muted mt-1">Checking serviceability…</div>}
            {serviceability === "skipped" && (
              <div className="text-xs text-warning mt-1">Serviceability not checked (carrier API not configured)</div>
            )}
            {serviceability === "serviceable" && <div className="text-xs text-success mt-1">Serviceable</div>}
            {serviceability === "non_serviceable" && (
              <div className="text-xs text-danger mt-1">Not serviceable by this carrier</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>Weight (kg)</label>
            <input required type="number" step="0.01" min="0.01" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={inputClass} />
          </div>
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

        <div className="grid grid-cols-2 gap-4">
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
        </div>

        {clients && clients.length === 0 && (
          <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded px-2 py-1.5">
            No clients found. Run <span className="font-mono">supabase/seed.sql</span> (includes Test Client) or insert a
            row into <span className="font-mono">clients</span>.
          </div>
        )}
        {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}
        {success && (
          <div className="text-xs text-success bg-success/10 border border-success/30 rounded px-2 py-1.5">
            {success.text}{" "}
            {success.shipmentId && (
              <Link to={`/shipments/${success.shipmentId}`} className="underline decoration-dotted">
                View shipment
              </Link>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !clientId || serviceability === "non_serviceable"}
          className="bg-accent text-accent-fg rounded py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 self-start px-6"
        >
          {submitting ? "Booking..." : "Book shipment"}
        </button>
      </form>
    </AppLayout>
  );
}
