import { delhiveryHttp } from "./client.js";
import type { BookingRequest, BookingResult } from "../../lib/types.js";

/**
 * URL-encodes a value instead of stripping characters, per spec: avoid raw
 * &, #, %, ;, ) in the JSON body by encoding rather than deleting them.
 */
function urlEncodeField(value: string): string {
  return encodeURIComponent(value);
}

/**
 * POST /api/cmu/create.json
 * order_id must be unique per shipment (enforced again at the DB layer via a
 * unique constraint on shipments.order_id).
 */
export async function createShipment(request: BookingRequest): Promise<BookingResult> {
  const payload = {
    shipments: [
      {
        name: urlEncodeField(request.clientName),
        add: urlEncodeField(request.addressLine),
        city: urlEncodeField(request.city),
        pin: request.destinationPincode,
        order: request.orderId,
        payment_mode: request.paymentMode,
        weight: request.weightGrams,
        shipment_length: request.dimensions.lengthCm,
        shipment_width: request.dimensions.widthCm,
        shipment_height: request.dimensions.heightCm,
        cod_amount: request.paymentMode === "COD" ? request.shipmentValueRupees : 0,
        total_amount: request.shipmentValueRupees,
      },
    ],
    pickup_location: {
      pin: request.originPincode,
    },
  };

  const response = await delhiveryHttp.post("/api/cmu/create.json", payload);

  const packageResult = response.data?.packages?.[0];
  const awb = packageResult?.waybill;
  if (!awb) {
    throw new Error(`Delhivery booking did not return a waybill: ${JSON.stringify(response.data)}`);
  }

  return { awb, raw: response.data };
}
