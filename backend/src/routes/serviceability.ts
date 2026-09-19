import { Router } from "express";
import { z } from "zod";
import { getCarrierAdapter } from "../adapters/registry.js";
import { publicErrorMessage, sendError, sendUnexpectedError } from "../lib/http-error.js";
import { pincodeSchema } from "../lib/shipment-input.js";

export const serviceabilityRouter = Router();

const singleSchema = z.object({
  carrierCode: z.string().min(1).default("delhivery"),
  destinationPincode: pincodeSchema,
});

serviceabilityRouter.post("/serviceability-check", async (req, res) => {
  const parsed = singleSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Destination pincode must be a 6-digit Indian PIN.", {
      details: parsed.error.flatten(),
    });
  }

  try {
    const adapter = getCarrierAdapter(parsed.data.carrierCode);
    const result = await adapter.checkServiceability(parsed.data.destinationPincode);
    res.json(result);
  } catch (err) {
    sendUnexpectedError(res, err, "serviceability_check_failed", "Could not check serviceability.");
  }
});

const bulkSchema = z.object({
  carrierCode: z.string().min(1).default("delhivery"),
  destinationPincodes: z.array(pincodeSchema).min(1).max(500),
});

serviceabilityRouter.post("/serviceability-check/bulk", async (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Each destination pincode must be a 6-digit Indian PIN.", {
      details: parsed.error.flatten(),
    });
  }

  try {
    const adapter = getCarrierAdapter(parsed.data.carrierCode);
    // Delhivery's filter_codes param behavior with comma-separated pincodes
    // is unconfirmed, so check each individually rather than guess at a
    // batch shape — same caution the codebase already applies elsewhere
    // (e.g. the rate API's `ss` param).
    const uniquePincodes = [...new Set(parsed.data.destinationPincodes)];
    const results = await Promise.all(
      uniquePincodes.map(async (pincode) => {
        try {
          return await adapter.checkServiceability(pincode);
        } catch (err) {
          return {
            pincode,
            serviceable: false,
            error: publicErrorMessage(err, "Could not check this pincode."),
          };
        }
      }),
    );
    res.json({ results });
  } catch (err) {
    sendUnexpectedError(res, err, "bulk_serviceability_check_failed", "Could not check serviceability.");
  }
});
