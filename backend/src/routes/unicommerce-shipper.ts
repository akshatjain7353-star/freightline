import { Router } from "express";
import { z } from "zod";
import { requireUnicommerceToken } from "../middleware/unicommerce-auth.js";
import {
  authenticateSeller,
  cancelWaybill,
  createWaybillFromUnicommerceOrder,
  getWaybillDetails,
} from "../services/unicommerce-shipper-service.js";

/**
 * This router speaks Unicommerce's shipper envelope (`status` / `reason` /
 * `errorMessage`), not the ops-console `{ error, message }` shape. Do not
 * wrap responses in sendError — a contract change would break the seller
 * integration. Manifest is still unimplemented (honest FAILED, no fake URL).
 */
export const unicommerceShipperRouter = Router();

const authSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

// Deliberately no requireUnicommerceToken here - this is what bootstraps the
// session in the first place.
unicommerceShipperRouter.post("/authToken", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ status: "INVALID_CREDENTIALS" });
  }
  const result = await authenticateSeller(parsed.data.username, parsed.data.password);
  res.json(result);
});

const waybillSchema = z.object({
  code: z.string().min(1),
  weight: z.number().positive(),
  length: z.number().positive(),
  height: z.number().positive(),
  breadth: z.number().positive(),
  paymentMode: z.enum(["COD", "PREPAID"]),
  totalAmount: z.number().nonnegative(),
  deliveryAddress: z.object({
    name: z.string().min(1),
    address1: z.string().min(1),
    city: z.string().min(1),
    pincode: z.string().min(4),
  }),
  pickupAddress: z.object({
    pincode: z.string().min(4),
  }),
});

unicommerceShipperRouter.post("/waybill", requireUnicommerceToken, async (req, res) => {
  const parsed = waybillSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ status: "FAILED", reason: "WRONG INPUT", message: "Invalid request payload." });
  }
  const result = await createWaybillFromUnicommerceOrder(req.unicommerceClient!.clientId, parsed.data);
  res.status(result.status === "SUCCESS" ? 200 : 400).json(result);
});

unicommerceShipperRouter.get("/waybillDetails", requireUnicommerceToken, async (req, res) => {
  const waybillsParam = req.query.waybills;
  if (typeof waybillsParam !== "string") {
    return res.status(400).json({ status: "FAILED", message: "Missing waybills query param." });
  }
  const waybills = waybillsParam
    .split(",")
    .map((w) => w.trim().replace(/^"|"$/g, ""))
    .filter(Boolean)
    .slice(0, 50);

  const details = await getWaybillDetails(req.unicommerceClient!.clientId, waybills);
  res.json(details);
});

const cancelSchema = z.object({ waybill: z.string().min(1) });

unicommerceShipperRouter.post("/cancel", requireUnicommerceToken, async (req, res) => {
  const parsed = cancelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ status: "FAILED", errorMessage: "Invalid request payload." });
  }
  const result = await cancelWaybill(req.unicommerceClient!.clientId, parsed.data.waybill, undefined);
  res.json(result);
});

// PDF manifest generation needs a PDF-rendering + file-hosting capability
// this app doesn't have yet - explicitly out of scope this pass rather than
// faking a manifest URL.
unicommerceShipperRouter.post("/manifest", requireUnicommerceToken, (_req, res) => {
  res.status(400).json({ status: "FAILED", message: "Manifest generation is not implemented yet." });
});
