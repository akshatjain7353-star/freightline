import { Router, type Response } from "express";
import { z } from "zod";
import {
  approveDtoRequest,
  DtoRequestNotFoundError,
  DtoRequestNotPendingError,
  listPendingDtoRequests,
  rejectDtoRequest,
} from "../services/dto-request-service.js";
import { FeatureNotReadyError, featureNotReadyPayload } from "../lib/feature-readiness.js";

export const dtoRequestsRouter = Router();

dtoRequestsRouter.get("/dto-requests", async (_req, res) => {
  try {
    const requests = await listPendingDtoRequests();
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: "dto_requests_fetch_failed", message: (err as Error).message });
  }
});

function handleError(err: unknown, res: Response) {
  if (err instanceof FeatureNotReadyError) {
    return res.status(501).json(featureNotReadyPayload(err));
  }
  if (err instanceof DtoRequestNotFoundError) {
    return res.status(404).json({ error: "dto_request_not_found", message: err.message });
  }
  if (err instanceof DtoRequestNotPendingError) {
    return res.status(409).json({ error: "dto_request_not_pending", message: err.message });
  }
  res.status(500).json({ error: "dto_request_action_failed", message: (err as Error).message });
}

const approveSchema = z.object({
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pickupDate must be YYYY-MM-DD"),
});

dtoRequestsRouter.post("/dto-requests/:id/approve", async (req, res) => {
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  try {
    const result = await approveDtoRequest(req.params.id, parsed.data.pickupDate, req.user?.id);
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
});

const rejectSchema = z.object({ reason: z.string().min(1) });

dtoRequestsRouter.post("/dto-requests/:id/reject", async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  try {
    const dtoRequest = await rejectDtoRequest(req.params.id, parsed.data.reason, req.user?.id);
    res.json({ dtoRequest });
  } catch (err) {
    handleError(err, res);
  }
});
