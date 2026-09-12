import { delhiveryHttp } from "./client.js";
import type { BookingResult, ReversePickupRequest } from "../../lib/types.js";

/**
 * POST /api/cmu/create.json for a reverse pickup (DTO) — Delhivery documents
 * reverse pickups as booked through the same manifest endpoint used for
 * forward shipments, distinguished by a return flag/pincode. The exact field
 * name Delhivery expects for that flag is unconfirmed — `return_pin` here is
 * a best guess mirroring the forward payload shape in booking.ts. Verify
 * against sandbox before relying on this for real DTO bookings.
 */
export async function scheduleReversePickup(request: ReversePickupRequest): Promise<BookingResult> {
  const payload = {
    shipments: [
      {
        name: encodeURIComponent(request.clientName),
        add: encodeURIComponent(request.addressLine),
        city: encodeURIComponent(request.city),
        pin: request.pickupPincode,
        order: request.orderId,
        payment_mode: "Prepaid",
        weight: request.weightGrams,
        shipment_length: request.dimensions.lengthCm,
        shipment_width: request.dimensions.widthCm,
        shipment_height: request.dimensions.heightCm,
        total_amount: request.shipmentValueRupees,
        return_pin: request.destinationPincode,
        pickup_date: request.pickupDate,
      },
    ],
    pickup_location: { pin: request.destinationPincode },
  };

  const response = await delhiveryHttp.post("/api/cmu/create.json", payload);

  const packageResult = response.data?.packages?.[0];
  const awb = packageResult?.waybill;
  if (!awb) {
    throw new Error(`Delhivery reverse-pickup booking did not return a waybill: ${JSON.stringify(response.data)}`);
  }

  return { awb, raw: response.data };
}
