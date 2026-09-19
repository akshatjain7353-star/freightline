import { Router } from "express";
import { z } from "zod";
import { sendError, sendUnexpectedError } from "../lib/http-error.js";
import { requireRole } from "../middleware/auth.js";
import { listRateCards, createNewRateCardVersion } from "../services/rate-card-service.js";

export const rateCardsRouter = Router();

const SLAB_KEYS = [
  "flat_0_250",
  "flat_upto_500",
  "flat_upto_5000",
  "flat_upto_10000",
  "additional_500g_500_to_5000",
  "additional_1kg_5000_to_10000",
  "additional_1kg_beyond_10000",
] as const;

rateCardsRouter.get("/rate-cards", requireRole("admin", "accounts_ops"), async (req, res) => {
  const carrierCode = typeof req.query.carrierCode === "string" ? req.query.carrierCode : "delhivery";
  try {
    const rateCards = await listRateCards(carrierCode);
    res.json({ rateCards });
  } catch (err) {
    sendUnexpectedError(res, err, "rate_cards_fetch_failed", "Could not load rate cards.");
  }
});

const newVersionSchema = z.object({
  carrierCode: z.string().min(1).default("delhivery"),
  name: z.string().min(1),
  fuelSurchargePercent: z.number().nonnegative(),
  codChargePercent: z.number().nonnegative(),
  codChargeMinimumRupees: z.number().nonnegative(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveFrom must be YYYY-MM-DD"),
  slabPrices: z
    .array(
      z.object({
        slabKey: z.enum(SLAB_KEYS),
        zoneCode: z.string().min(1),
        priceRupees: z.number().nonnegative(),
        rateType: z.enum(["forward", "dto"]),
      }),
    )
    .min(1),
});

rateCardsRouter.post("/rate-cards", requireRole("admin", "accounts_ops"), async (req, res) => {
  const parsed = newVersionSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Check rate card name, dates, and slab prices.", {
      details: parsed.error.flatten(),
    });
  }

  try {
    const newCard = await createNewRateCardVersion(parsed.data, req.user?.id);
    res.status(201).json({ rateCard: newCard });
  } catch (err) {
    sendUnexpectedError(res, err, "rate_card_creation_failed", "Could not save this rate card version.");
  }
});
