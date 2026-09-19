import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth.js";
import { sendError, sendUnexpectedError } from "../lib/http-error.js";
import { listSettlementRuns, remitCodToClient, settlePeriod } from "../services/settlement-service.js";

export const settlementsRouter = Router();

const periodSchema = z.object({
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "periodFrom must be YYYY-MM-DD"),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "periodTo must be YYYY-MM-DD"),
});

settlementsRouter.post("/clients/:id/settle-period", requireRole("admin", "accounts_ops"), async (req, res) => {
  const clientId = req.params.id;
  if (!clientId) return sendError(res, 400, "invalid_request", "Missing client id");
  const parsed = periodSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Check the settlement period dates.", {
      details: parsed.error.flatten(),
    });
  }
  try {
    const run = await settlePeriod(clientId, parsed.data.periodFrom, parsed.data.periodTo, req.user?.id);
    res.status(201).json({ settlementRun: run });
  } catch (err) {
    sendUnexpectedError(res, err, "settlement_failed", "Could not settle this period.");
  }
});

settlementsRouter.get("/clients/:id/settlement-runs", requireRole("admin", "accounts_ops"), async (req, res) => {
  const clientId = req.params.id;
  if (!clientId) return sendError(res, 400, "invalid_request", "Missing client id");
  try {
    const runs = await listSettlementRuns(clientId);
    res.json({ settlementRuns: runs });
  } catch (err) {
    sendUnexpectedError(res, err, "settlement_runs_fetch_failed", "Could not load settlement runs.");
  }
});

const remitSchema = z.object({ amountRupees: z.number().positive(), reference: z.string().optional() });

settlementsRouter.post("/clients/:id/remit-cod", requireRole("admin", "accounts_ops"), async (req, res) => {
  const clientId = req.params.id;
  if (!clientId) return sendError(res, 400, "invalid_request", "Missing client id");
  const parsed = remitSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Check the remittance amount.", {
      details: parsed.error.flatten(),
    });
  }
  try {
    await remitCodToClient(clientId, parsed.data.amountRupees, parsed.data.reference, req.user?.id);
    res.status(201).json({ ok: true });
  } catch (err) {
    sendUnexpectedError(res, err, "cod_remittance_failed", "Could not remit COD to this client.");
  }
});
