import { Router } from "express";
import { ClientScopeError } from "../lib/client-scope.js";
import { sendError, sendUnexpectedError } from "../lib/http-error.js";
import { requireClientUser } from "../middleware/auth.js";
import {
  getClientProfile,
  getClientShipment,
  getClientShipmentTracking,
  listClientShipments,
} from "../services/client-portal-service.js";

export const clientPortalRouter = Router();

clientPortalRouter.use(requireClientUser);

function handleScope(res: import("express").Response, err: unknown, fallbackCode: string, fallback: string) {
  if (err instanceof ClientScopeError) {
    return sendError(res, 403, err.code, err.message);
  }
  sendUnexpectedError(res, err, fallbackCode, fallback);
}

clientPortalRouter.get("/me", async (req, res) => {
  try {
    res.json(await getClientProfile(req.user?.clientId));
  } catch (err) {
    handleScope(res, err, "client_profile_failed", "Could not load this client account.");
  }
});

clientPortalRouter.get("/shipments", async (req, res) => {
  const page = Math.max(0, parseInt(String(req.query.page ?? "0"), 10) || 0);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  try {
    res.json(await listClientShipments(req.user?.clientId, page, search));
  } catch (err) {
    handleScope(res, err, "client_shipments_failed", "Could not load your shipments.");
  }
});

clientPortalRouter.get("/shipments/:id", async (req, res) => {
  try {
    res.json({ shipment: await getClientShipment(req.user?.clientId, req.params.id) });
  } catch (err) {
    handleScope(res, err, "client_shipment_failed", "Could not load this shipment.");
  }
});

clientPortalRouter.get("/shipments/:id/tracking", async (req, res) => {
  try {
    res.json({ events: await getClientShipmentTracking(req.user?.clientId, req.params.id) });
  } catch (err) {
    handleScope(res, err, "client_tracking_failed", "Could not load tracking for this shipment.");
  }
});
