import { Router, type Response } from "express";
import { z } from "zod";
import {
  approveDtoRequest,
  DtoRequestNotFoundError,
  DtoRequestNotPendingError,
  listPendingDtoRequests,
  rejectDtoRequest,
} from "../services/dto-request-service.js";
import { sendError, sendUnexpectedError } from "../lib/http-error.js";

export const dtoRequestsRouter = Router();

dtoRequestsRouter.get("/dto-requests", async (_req, res) => {
  try {
    const requests = await listPendingDtoRequests();
    res.json({ requests });
  } catch (err) {
    sendUnexpectedError(res, err, "dto_requests_fetch_failed", "Could not load DTO requests.");
  }
});

function handleError(err: unknown, res: Response) {
  if (err instanceof DtoRequestNotFoundError) {
    return sendError(res, 404, "dto_request_not_found", err.message);
  }
  if (err instanceof DtoRequestNotPendingError) {
    return sendError(res, 409, "dto_request_not_pending", err.message);
  }
  sendUnexpectedError(res, err, "dto_request_action_failed", "Could not update this DTO request.");
}

const approveSchema = z.object({
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pickupDate must be YYYY-MM-DD"),
});

dtoRequestsRouter.post("/dto-requests/:id/approve", async (req, res) => {
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Pickup date must be YYYY-MM-DD.", {
      details: parsed.error.flatten(),
    });
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
    return sendError(res, 400, "invalid_request", "A rejection reason is required.", {
      details: parsed.error.flatten(),
    });
  }
  try {
    const dtoRequest = await rejectDtoRequest(req.params.id, parsed.data.reason, req.user?.id);
    res.json({ dtoRequest });
  } catch (err) {
    handleError(err, res);
  }
});
