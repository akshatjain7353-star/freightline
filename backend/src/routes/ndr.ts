import { Router, type Response } from "express";
import { z } from "zod";
import { supabase } from "../supabase/client.js";
import {
  contactCustomer,
  convertToRto,
  editDeliveryAddress,
  MaxAttemptsExceededError,
  requestReattempt,
  ShipmentNotFoundError,
} from "../services/ndr-service.js";
import { sendError, sendUnexpectedError } from "../lib/http-error.js";

export const ndrRouter = Router();

ndrRouter.get("/ndr-queue", async (_req, res) => {
  const { data, error } = await supabase
    .from("shipments_ops_view")
    .select("*")
    .eq("status", "ndr")
    .order("created_at", { ascending: false });
  if (error) {
    return sendError(res, 500, "ndr_queue_fetch_failed", "Could not load the NDR queue.");
  }
  res.json({ shipments: data ?? [] });
});

function handleServiceError(err: unknown, res: Response) {
  if (err instanceof ShipmentNotFoundError) {
    return sendError(res, 404, "shipment_not_found", err.message);
  }
  if (err instanceof MaxAttemptsExceededError) {
    return sendError(res, 422, "max_attempts_exceeded", err.message);
  }
  sendUnexpectedError(res, err, "ndr_action_failed", "Could not complete this NDR action.");
}

ndrRouter.post("/shipments/:id/ndr/reattempt", async (req, res) => {
  try {
    const result = await requestReattempt(req.params.id, req.user?.id);
    res.json(result);
  } catch (err) {
    handleServiceError(err, res);
  }
});

const addressSchema = z.object({ addressLine: z.string().min(1), city: z.string().min(1) });

ndrRouter.post("/shipments/:id/ndr/address", async (req, res) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Address and city are required.", {
      details: parsed.error.flatten(),
    });
  }
  try {
    const shipment = await editDeliveryAddress(req.params.id, parsed.data.addressLine, parsed.data.city, req.user?.id);
    res.json({ shipment });
  } catch (err) {
    handleServiceError(err, res);
  }
});

const contactSchema = z.object({ notes: z.string().min(1) });

ndrRouter.post("/shipments/:id/ndr/contact", async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Contact notes are required.", {
      details: parsed.error.flatten(),
    });
  }
  try {
    await contactCustomer(req.params.id, parsed.data.notes, req.user?.id);
    res.json({ ok: true });
  } catch (err) {
    handleServiceError(err, res);
  }
});

ndrRouter.post("/shipments/:id/ndr/convert-rto", async (req, res) => {
  try {
    const shipment = await convertToRto(req.params.id, req.user?.id);
    res.json({ shipment });
  } catch (err) {
    handleServiceError(err, res);
  }
});
