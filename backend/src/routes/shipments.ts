import { Router } from "express";
import { PincodeNotMappedError } from "../rate-engine/zone-resolver.js";
import { bookAndCreateShipment, NonServiceableError } from "../services/shipment-service.js";
import { maskCostFieldsForRole } from "../lib/mask-cost.js";
import { createShipmentRequestSchema } from "../lib/shipment-input.js";
import { sendError, sendUnexpectedError } from "../lib/http-error.js";

export const shipmentsRouter = Router();

shipmentsRouter.post("/shipments", async (req, res) => {
  const parsed = createShipmentRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Check order ID, client, 6-digit pincodes, and package details.", {
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await bookAndCreateShipment(parsed.data);
    const bookingMode = result.shipment.awb ? "carrier" : "local_offline";
    res.status(201).json({
      ...maskCostFieldsForRole(result, req.user?.role),
      bookingMode,
    });
  } catch (err) {
    if (err instanceof PincodeNotMappedError) {
      return sendError(res, 422, "pincode_not_mapped", err.message);
    }
    if (err instanceof NonServiceableError) {
      return sendError(res, 422, "non_serviceable", err.message);
    }
    console.error("Shipment creation error:", err);
    sendUnexpectedError(res, err, "shipment_creation_failed", "Could not save this shipment.");
  }
});
