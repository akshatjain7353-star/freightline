import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth.js";
import { sendError, sendUnexpectedError } from "../lib/http-error.js";
import { createNewClientRateCardVersion, listClientRateCards } from "../services/client-rate-card-service.js";

export const clientRateCardsRouter = Router();

const SLAB_KEYS = [
  "flat_0_250",
  "flat_upto_500",
  "flat_upto_5000",
  "flat_upto_10000",
  "additional_500g_500_to_5000",
  "additional_1kg_5000_to_10000",
  "additional_1kg_beyond_10000",
] as const;

clientRateCardsRouter.get("/client-rate-cards", requireRole("admin", "accounts_ops"), async (req, res) => {
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
  if (!clientId) return sendError(res, 400, "invalid_request", "clientId is required");
  try {
    const rateCards = await listClientRateCards(clientId);
    res.json({ rateCards });
  } catch (err) {
    sendUnexpectedError(res, err, "client_rate_cards_fetch_failed", "Could not load client rate cards.");
  }
});

const newVersionSchema = z.object({
  clientId: z.string().uuid(),
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

clientRateCardsRouter.post("/client-rate-cards", requireRole("admin", "accounts_ops"), async (req, res) => {
  const parsed = newVersionSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Check client, dates, and slab prices.", {
      details: parsed.error.flatten(),
    });
  }
  try {
    const newCard = await createNewClientRateCardVersion(parsed.data, req.user?.id);
    res.status(201).json({ rateCard: newCard });
  } catch (err) {
    sendUnexpectedError(res, err, "client_rate_card_creation_failed", "Could not save this client rate card.");
  }
});
