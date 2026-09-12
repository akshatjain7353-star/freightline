import { Router } from "express";
import { z } from "zod";
import { getDtoRequest, submitDtoRequest, DtoRequestNotFoundError } from "../services/dto-request-service.js";

export const externalDtoRequestsRouter = Router();

const submitSchema = z.object({
  externalReference: z.string().min(1).optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  pickupAddressLine: z.string().min(1),
  pickupCity: z.string().min(1),
  pickupPincode: z.string().min(4),
  destinationPincode: z.string().min(4),
  weightGrams: z.number().positive(),
  dimensions: z.object({
    lengthCm: z.number().positive(),
    widthCm: z.number().positive(),
    heightCm: z.number().positive(),
  }),
  reason: z.string().optional(),
  carrierCode: z.string().min(1).optional(),
});

externalDtoRequestsRouter.post("/dto-requests", async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  if (!req.apiClient) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const result = await submitDtoRequest(req.apiClient.clientId, parsed.data);
    res.status(201).json({ requestId: result.id, status: result.status });
  } catch (err) {
    res.status(500).json({ error: "dto_request_submit_failed", message: (err as Error).message });
  }
});

externalDtoRequestsRouter.get("/dto-requests/:id", async (req, res) => {
  if (!req.apiClient) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const request = await getDtoRequest(req.params.id, req.apiClient.clientId);
    res.json({
      requestId: request.id,
      status: request.status,
      createdShipmentId: request.created_shipment_id,
      rejectionReason: request.rejection_reason,
    });
  } catch (err) {
    if (err instanceof DtoRequestNotFoundError) {
      return res.status(404).json({ error: "dto_request_not_found" });
    }
    res.status(500).json({ error: "dto_request_fetch_failed", message: (err as Error).message });
  }
});
