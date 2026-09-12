import { useState, type FormEvent } from "react";
import { AppLayout } from "../components/layout/AppLayout";
import { createReversePickup } from "../api/backend";
import { useCarriers, useClients } from "../hooks/useReferenceData";

const inputClass =
  "bg-surface2 border border-border rounded px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-accent w-full";
const labelClass = "text-xs text-secondary mb-1 block";

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function CreateReversePickup() {
  const { data: clients } = useClients();
  const { data: carriers } = useCarriers();

  const [orderId, setOrderId] = useState("");
  const [clientId, setClientId] = useState("");
  const [carrierCode, setCarrierCode] = useState("delhivery");
  const [pickupAddressLine, setPickupAddressLine] = useState("");
  const [pickupCity, setPickupCity] = useState("");
  const [pickupPincode, setPickupPincode] = useState("");
  const [destinationPincode, setDestinationPincode] = useState("");
  const [weightKg, setWeightKg] = useState("1");
  const [length, setLength] = useState("10");
  const [width, setWidth] = useState("10");
  const [height, setHeight] = useState("10");
  const [pickupDate, setPickupDate] = useState(tomorrow());
  const [shipmentValue, setShipmentValue] = useState("500");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const client = clients?.find((c) => c.id === clientId);
    try {
      const result = await createReversePickup({
        orderId,
        clientId,
        clientName: client?.name ?? "",
        carrierCode,
        pickupAddressLine,
        pickupCity,
        pickupPincode,
        destinationPincode,
        weightGrams: parseFloat(weightKg) * 1000,
        dimensions: { lengthCm: parseFloat(length), widthCm: parseFloat(width), heightCm: parseFloat(height) },
        shipmentValueRupees: parseFloat(shipmentValue) || 0,
        pickupDate,
      });
      setSuccess(`Reverse pickup booked. AWB: ${result.shipment.awb}`);
      setOrderId("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout title="Create Reverse Pickup">
      <form onSubmit={handleSubmit} className="max-w-2xl bg-surface border border-border rounded p-5 flex flex-col gap-4">
        <p className="text-xs text-muted -mt-1">
          Books a reverse pickup (RTV/DTO) with no prior Time Bound shipment involved — the carrier collects from the
          customer's address below and returns the item to the destination pincode.
        </p>

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
            <label className={labelClass}>Pickup address (customer's home)</label>
            <input
              required
              value={pickupAddressLine}
              onChange={(e) => setPickupAddressLine(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Pickup city</label>
            <input required value={pickupCity} onChange={(e) => setPickupCity(e.target.value)} className={inputClass} />
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
            <label className={labelClass}>Pickup pincode</label>
            <input
              required
              value={pickupPincode}
              onChange={(e) => setPickupPincode(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Destination pincode (return to)</label>
            <input
              required
              value={destinationPincode}
              onChange={(e) => setDestinationPincode(e.target.value)}
              className={inputClass}
            />
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
            <label className={labelClass}>Pickup date</label>
            <input required type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Item value (₹)</label>
            <input type="number" step="1" min="0" value={shipmentValue} onChange={(e) => setShipmentValue(e.target.value)} className={inputClass} />
          </div>
        </div>

        {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}
        {success && <div className="text-xs text-success bg-success/10 border border-success/30 rounded px-2 py-1.5">{success}</div>}

        <button
          type="submit"
          disabled={submitting || !clientId}
          className="bg-accent text-accent-fg rounded py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 self-start px-6"
        >
          {submitting ? "Booking..." : "Book reverse pickup"}
        </button>
      </form>
    </AppLayout>
  );
}
