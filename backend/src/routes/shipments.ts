import { Router } from "express";
import { z } from "zod";
import { PincodeNotMappedError } from "../rate-engine/zone-resolver.js";
import { bookAndCreateShipment, NonServiceableError } from "../services/shipment-service.js";
import { maskCostFieldsForRole } from "../lib/mask-cost.js";

const createShipmentSchema = z.object({
  orderId: z.string().min(1),
  clientId: z.string().uuid(),
  clientName: z.string().min(1),
  addressLine: z.string().min(1),
  city: z.string().min(1),
  carrierCode: z.string().min(1).default("delhivery"),
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

export const shipmentsRouter = Router();

shipmentsRouter.post("/shipments", async (req, res) => {
  const parsed = createShipmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }

  try {
    const result = await bookAndCreateShipment(parsed.data);
    res.status(201).json(maskCostFieldsForRole(result, req.user?.role));
  } catch (err) {
    if (err instanceof PincodeNotMappedError) {
      return res.status(422).json({ error: "pincode_not_mapped", message: err.message });
    }
    if (err instanceof NonServiceableError) {
      return res.status(422).json({ error: "non_serviceable", message: err.message });
    }
    console.error("Shipment creation error:", err);
    res.status(500).json({ error: "shipment_creation_failed", message: (err as Error).message });
  }
});
