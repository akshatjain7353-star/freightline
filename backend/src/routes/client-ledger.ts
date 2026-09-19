import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth.js";
import { sendError, sendUnexpectedError } from "../lib/http-error.js";
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
    sendUnexpectedError(res, err, "client_ledger_summary_failed", "Could not load ledger summaries.");
  }
});

clientLedgerRouter.get("/client-ledger/:clientId", requireRole("admin", "accounts_ops"), async (req, res) => {
  const clientId = req.params.clientId;
  if (!clientId) return sendError(res, 400, "invalid_request", "Missing clientId");
  try {
    const entries = await listClientLedgerEntries(clientId);
    res.json({ entries });
  } catch (err) {
    sendUnexpectedError(res, err, "client_ledger_fetch_failed", "Could not load this client's ledger.");
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
    return sendError(res, 400, "invalid_request", "Check client, amount, and payment date.", {
      details: parsed.error.flatten(),
    });
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
    sendUnexpectedError(res, err, "payment_recording_failed", "Could not record this payment.");
  }
});
