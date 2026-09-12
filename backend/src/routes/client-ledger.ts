import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth.js";
import {
  getClientLedgerSummaries,
  listClientLedgerEntries,
  recordClientPayment,
} from "../services/client-ledger-service.js";

export const clientLedgerRouter = Router();

clientLedgerRouter.get("/client-ledger/summary", requireRole("admin", "accounts_ops"), async (_req, res) => {
  try {
    const summaries = await getClientLedgerSummaries();
    res.json({ summaries });
  } catch (err) {
    res.status(500).json({ error: "client_ledger_summary_failed", message: (err as Error).message });
  }
});

clientLedgerRouter.get("/client-ledger/:clientId", requireRole("admin", "accounts_ops"), async (req, res) => {
  const clientId = req.params.clientId;
  if (!clientId) return res.status(400).json({ error: "invalid_request", message: "Missing clientId" });
  try {
    const entries = await listClientLedgerEntries(clientId);
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: "client_ledger_fetch_failed", message: (err as Error).message });
  }
});

const paymentSchema = z.object({
  clientId: z.string().uuid(),
  amountRupees: z.number().positive(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "paymentDate must be YYYY-MM-DD"),
  reference: z.string().optional(),
});

clientLedgerRouter.post("/client-payments", requireRole("admin", "accounts_ops"), async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  try {
    const payment = await recordClientPayment(
      parsed.data.clientId,
      parsed.data.amountRupees,
      parsed.data.paymentDate,
      parsed.data.reference,
      req.user?.id,
    );
    res.status(201).json({ payment });
  } catch (err) {
    res.status(500).json({ error: "payment_recording_failed", message: (err as Error).message });
  }
});
