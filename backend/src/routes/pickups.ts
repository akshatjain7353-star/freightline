import { Router } from "express";
import { z } from "zod";
import {
  createStandaloneReversePickup,
  generateLabel,
  schedulePickup,
  scheduleReversePickup,
  ShipmentNotFoundError,
} from "../services/pickup-service.js";
import { sendError, sendUnexpectedError } from "../lib/http-error.js";
import { pincodeSchema } from "../lib/shipment-input.js";

export const pickupsRouter = Router();

const pickupSchema = z.object({ pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pickupDate must be YYYY-MM-DD") });

const standaloneReversePickupSchema = z.object({
  orderId: z.string().min(1),
  clientId: z.string().uuid(),
  clientName: z.string().min(1),
  carrierCode: z.string().min(1).default("delhivery"),
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
  shipmentValueRupees: z.number().nonnegative().default(0),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pickupDate must be YYYY-MM-DD"),
});

pickupsRouter.post("/shipments/:id/pickup", async (req, res) => {
  const parsed = pickupSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Pickup date must be YYYY-MM-DD.", {
      details: parsed.error.flatten(),
    });
  }
  try {
    const pickupRequest = await schedulePickup(req.params.id, parsed.data.pickupDate, req.user?.id);
    res.status(201).json({ pickupRequest });
  } catch (err) {
    if (err instanceof ShipmentNotFoundError) {
      return sendError(res, 404, "shipment_not_found", err.message);
    }
    sendUnexpectedError(res, err, "pickup_scheduling_failed", "Could not schedule this pickup.");
  }
});

pickupsRouter.post("/shipments/:id/reverse-pickup", async (req, res) => {
  const parsed = pickupSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Pickup date must be YYYY-MM-DD.", {
      details: parsed.error.flatten(),
    });
  }
  try {
    const result = await scheduleReversePickup(req.params.id, parsed.data.pickupDate, req.user?.id);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ShipmentNotFoundError) {
      return sendError(res, 404, "shipment_not_found", err.message);
    }
    sendUnexpectedError(res, err, "reverse_pickup_failed", "Could not book this reverse pickup.");
  }
});

pickupsRouter.post("/reverse-pickups", async (req, res) => {
  const parsed = standaloneReversePickupSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Check client, 6-digit pincodes, and pickup date.", {
      details: parsed.error.flatten(),
    });
  }
  try {
    const result = await createStandaloneReversePickup(parsed.data, req.user?.id);
    res.status(201).json(result);
  } catch (err) {
    sendUnexpectedError(res, err, "reverse_pickup_failed", "Could not book this reverse pickup.");
  }
});

pickupsRouter.get("/shipments/:id/label", async (req, res) => {
  try {
    const label = await generateLabel(req.params.id);
    res.json(label);
  } catch (err) {
    if (err instanceof ShipmentNotFoundError) {
      return sendError(res, 404, "shipment_not_found", err.message);
    }
    sendUnexpectedError(res, err, "label_generation_failed", "Could not load this shipping label.");
  }
});
