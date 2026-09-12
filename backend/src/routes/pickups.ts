import { Router } from "express";
import { z } from "zod";
import {
  createStandaloneReversePickup,
  generateLabel,
  schedulePickup,
  scheduleReversePickup,
  ShipmentNotFoundError,
} from "../services/pickup-service.js";

export const pickupsRouter = Router();

const pickupSchema = z.object({ pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pickupDate must be YYYY-MM-DD") });

const standaloneReversePickupSchema = z.object({
  orderId: z.string().min(1),
  clientId: z.string().uuid(),
  clientName: z.string().min(1),
  carrierCode: z.string().min(1).default("delhivery"),
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
  shipmentValueRupees: z.number().nonnegative().default(0),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pickupDate must be YYYY-MM-DD"),
});

pickupsRouter.post("/shipments/:id/pickup", async (req, res) => {
  const parsed = pickupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  try {
    const pickupRequest = await schedulePickup(req.params.id, parsed.data.pickupDate, req.user?.id);
    res.status(201).json({ pickupRequest });
  } catch (err) {
    if (err instanceof ShipmentNotFoundError) {
      return res.status(404).json({ error: "shipment_not_found", message: err.message });
    }
    res.status(500).json({ error: "pickup_scheduling_failed", message: (err as Error).message });
  }
});

pickupsRouter.post("/shipments/:id/reverse-pickup", async (req, res) => {
  const parsed = pickupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  try {
    const result = await scheduleReversePickup(req.params.id, parsed.data.pickupDate, req.user?.id);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ShipmentNotFoundError) {
      return res.status(404).json({ error: "shipment_not_found", message: err.message });
    }
    res.status(500).json({ error: "reverse_pickup_failed", message: (err as Error).message });
  }
});

pickupsRouter.post("/reverse-pickups", async (req, res) => {
  const parsed = standaloneReversePickupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  try {
    const result = await createStandaloneReversePickup(parsed.data, req.user?.id);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: "reverse_pickup_failed", message: (err as Error).message });
  }
});

pickupsRouter.get("/shipments/:id/label", async (req, res) => {
  try {
    const label = await generateLabel(req.params.id);
    res.json(label);
  } catch (err) {
    if (err instanceof ShipmentNotFoundError) {
      return res.status(404).json({ error: "shipment_not_found", message: err.message });
    }
    res.status(500).json({ error: "label_generation_failed", message: (err as Error).message });
  }
});
