import { Router } from "express";
import { z } from "zod";
import { PincodeNotMappedError } from "../rate-engine/zone-resolver.js";
import { bookAndCreateShipment, NonServiceableError } from "../services/shipment-service.js";
import { createShipmentRequestSchema } from "../lib/shipment-input.js";
import { publicErrorMessage, sendError } from "../lib/http-error.js";

const bulkUploadSchema = z.object({
  rows: z.array(createShipmentRequestSchema).min(1).max(500),
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
    return sendError(res, 400, "invalid_request", "Each row needs a 6-digit pincode, client, and package details.", {
      details: parsed.error.flatten(),
    });
  }

  const results: RowResult[] = [];

  // Sequential, not parallel: avoids hammering the Delhivery API with a burst
  // of concurrent booking calls from one bulk upload.
  for (const row of parsed.data.rows) {
    try {
      const { shipment } = await bookAndCreateShipment({ ...row, source: "bulk_upload" });
      results.push({ orderId: row.orderId, success: true, awb: shipment.awb ?? undefined });
    } catch (err) {
      let message = publicErrorMessage(err, "Could not save this row.");
      if (err instanceof PincodeNotMappedError) message = err.message;
      if (err instanceof NonServiceableError) message = err.message;
      results.push({ orderId: row.orderId, success: false, error: message });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  res.json({ total: results.length, successCount, failureCount: results.length - successCount, results });
});
