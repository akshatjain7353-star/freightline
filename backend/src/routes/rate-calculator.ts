import { Router } from "express";
import { z } from "zod";
import { listCarrierAdapters } from "../adapters/registry.js";
import { PincodeNotMappedError } from "../rate-engine/zone-resolver.js";

const requestSchema = z.object({
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

export const rateCalculatorRouter = Router();

rateCalculatorRouter.post("/rate-calculator", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }

  try {
    const quotes = await Promise.all(
      listCarrierAdapters().map((adapter) => adapter.getRateQuote(parsed.data)),
    );
    // Ranked cheapest-first.
    quotes.sort((a, b) => a.totalCostRupees - b.totalCostRupees);
    res.json({ quotes });
  } catch (err) {
    if (err instanceof PincodeNotMappedError) {
      return res.status(422).json({ error: "pincode_not_mapped", message: err.message });
    }
    console.error("Rate calculator error:", err);
    res.status(500).json({ error: "rate_calculation_failed", message: (err as Error).message });
  }
});
