import { Router } from "express";
import { z } from "zod";
import { sendError, sendUnexpectedError } from "../lib/http-error.js";
import { pincodeSchema } from "../lib/shipment-input.js";
import { getDtoRequest, submitDtoRequest, DtoRequestNotFoundError } from "../services/dto-request-service.js";

export const externalDtoRequestsRouter = Router();

const submitSchema = z.object({
  externalReference: z.string().min(1).optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  pickupAddressLine: z.string().min(1),
  pickupCity: z.string().min(1),
  pickupPincode: pincodeSchema,
  destinationPincode: pincodeSchema,
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
    return sendError(res, 400, "invalid_request", "Check customer, address, and 6-digit pincodes.", {
      details: parsed.error.flatten(),
    });
  }
  if (!req.apiClient) {
    return sendError(res, 401, "unauthorized", "Valid client API key required.");
  }

  try {
    const result = await submitDtoRequest(req.apiClient.clientId, parsed.data);
    res.status(201).json({ requestId: result.id, status: result.status });
  } catch (err) {
    sendUnexpectedError(res, err, "dto_request_submit_failed", "Could not submit this DTO request.");
  }
});

externalDtoRequestsRouter.get("/dto-requests/:id", async (req, res) => {
  if (!req.apiClient) {
    return sendError(res, 401, "unauthorized", "Valid client API key required.");
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
      return sendError(res, 404, "dto_request_not_found", "DTO request not found.");
    }
    sendUnexpectedError(res, err, "dto_request_fetch_failed", "Could not load this DTO request.");
  }
});
