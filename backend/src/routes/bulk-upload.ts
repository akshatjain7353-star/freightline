import { Router } from "express";
import { z } from "zod";
import { PincodeNotMappedError } from "../rate-engine/zone-resolver.js";
import { bookAndCreateShipment, NonServiceableError } from "../services/shipment-service.js";

const bulkRowSchema = z.object({
  orderId: z.string().min(1),
  clientId: z.string().uuid(),
  clientName: z.string().min(1),
  addressLine: z.string().min(1),
  city: z.string().min(1),
  carrierCode: z.string().min(1).default("delhivery"),
  originPincode: z.string().min(4),
  destinationPincode: z.string().min(4),
  weightGrams: z.number().positive(),
  dimensions: z.object({
    lengthCm: z.number().positive(),
    widthCm: z.number().positive(),
    heightCm: z.number().positive(),
  }),
  paymentMode: z.enum(["COD", "Prepaid"]),
  shipmentValueRupees: z.number().nonnegative().default(0),
});

const bulkUploadSchema = z.object({
  rows: z.array(bulkRowSchema).min(1).max(500),
});

export const bulkUploadRouter = Router();

interface RowResult {
  orderId: string;
  success: boolean;
  awb?: string;
  error?: string;
}

bulkUploadRouter.post("/bulk-upload", async (req, res) => {
  const parsed = bulkUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }

  const results: RowResult[] = [];

  // Sequential, not parallel: avoids hammering the Delhivery API with a burst
  // of concurrent booking calls from one bulk upload.
  for (const row of parsed.data.rows) {
    try {
      const { shipment } = await bookAndCreateShipment({ ...row, source: "bulk_upload" });
      results.push({ orderId: row.orderId, success: true, awb: shipment.awb });
    } catch (err) {
      let message = (err as Error).message;
      if (err instanceof PincodeNotMappedError) message = err.message;
      if (err instanceof NonServiceableError) message = err.message;
      results.push({ orderId: row.orderId, success: false, error: message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  res.json({ total: results.length, successCount, failureCount: results.length - successCount, results });
});
