import { Router } from "express";
import { listCarrierAdapters } from "../adapters/registry.js";
import { PincodeNotMappedError } from "../rate-engine/zone-resolver.js";
import { requireRole } from "../middleware/auth.js";
import { rateCalculatorRequestSchema } from "../lib/shipment-input.js";
import { sendError, sendUnexpectedError } from "../lib/http-error.js";

export const rateCalculatorRouter = Router();

// The Rate Calculator is a pricing tool end to end — block it outright for
// ops_only rather than masking numbers within it (spec Section 11: ops_only
// gets "no pricing access", not "pricing access with numbers hidden").
rateCalculatorRouter.post("/rate-calculator", requireRole("admin", "accounts_ops"), async (req, res) => {
  const parsed = rateCalculatorRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Check pincodes (6 digits), weight, and dimensions.", {
      details: parsed.error.flatten(),
    });
  }

  try {
    const quotes = await Promise.all(listCarrierAdapters().map((adapter) => adapter.getRateQuote(parsed.data)));
    quotes.sort((a, b) => a.totalCostRupees - b.totalCostRupees);
    res.json({ quotes });
  } catch (err) {
    if (err instanceof PincodeNotMappedError) {
      return sendError(res, 422, "pincode_not_mapped", err.message);
    }
    console.error("Rate calculator error:", err);
    sendUnexpectedError(res, err, "rate_calculation_failed", "Could not calculate a rate for this route.");
  }
});
