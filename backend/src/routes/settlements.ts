import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth.js";
import { listSettlementRuns, remitCodToClient, settlePeriod } from "../services/settlement-service.js";

export const settlementsRouter = Router();

const periodSchema = z.object({
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "periodFrom must be YYYY-MM-DD"),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "periodTo must be YYYY-MM-DD"),
});

settlementsRouter.post("/clients/:id/settle-period", requireRole("admin", "accounts_ops"), async (req, res) => {
  const clientId = req.params.id;
  if (!clientId) return res.status(400).json({ error: "invalid_request", message: "Missing client id" });
  const parsed = periodSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  try {
    const run = await settlePeriod(clientId, parsed.data.periodFrom, parsed.data.periodTo, req.user?.id);
    res.status(201).json({ settlementRun: run });
  } catch (err) {
    res.status(500).json({ error: "settlement_failed", message: (err as Error).message });
  }
});

settlementsRouter.get("/clients/:id/settlement-runs", requireRole("admin", "accounts_ops"), async (req, res) => {
  const clientId = req.params.id;
  if (!clientId) return res.status(400).json({ error: "invalid_request", message: "Missing client id" });
  try {
    const runs = await listSettlementRuns(clientId);
    res.json({ settlementRuns: runs });
  } catch (err) {
    res.status(500).json({ error: "settlement_runs_fetch_failed", message: (err as Error).message });
  }
});

const remitSchema = z.object({ amountRupees: z.number().positive(), reference: z.string().optional() });

settlementsRouter.post("/clients/:id/remit-cod", requireRole("admin", "accounts_ops"), async (req, res) => {
  const clientId = req.params.id;
  if (!clientId) return res.status(400).json({ error: "invalid_request", message: "Missing client id" });
  const parsed = remitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  try {
    await remitCodToClient(clientId, parsed.data.amountRupees, parsed.data.reference, req.user?.id);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "cod_remittance_failed", message: (err as Error).message });
  }
});
