import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth.js";
import { sendError, sendUnexpectedError } from "../lib/http-error.js";
import { listCarrierRemittanceLines, reconcileCarrierRemittance } from "../services/carrier-remittance-service.js";

export const carrierRemittanceRouter = Router();

// Rows are parsed CSV -> JSON client-side, same pattern as vendor-invoices.ts.
const uploadSchema = z.object({
  carrierCode: z.string().min(1).default("delhivery"),
  fileName: z.string().optional(),
  rows: z.array(z.object({ awb: z.string().min(1), remittedAmountRupees: z.number().nonnegative() })).min(1).max(2000),
});

carrierRemittanceRouter.post("/carrier-remittance/reconcile", requireRole("admin", "accounts_ops"), async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Each row needs an AWB and a remitted amount.", {
      details: parsed.error.flatten(),
    });
  }
  try {
    const result = await reconcileCarrierRemittance(
      parsed.data.carrierCode,
      parsed.data.rows,
      parsed.data.fileName,
      req.user?.id,
    );
    res.status(201).json(result);
  } catch (err) {
    sendUnexpectedError(
      res,
      err,
      "carrier_remittance_reconciliation_failed",
      "Could not reconcile this remittance file.",
    );
  }
});

carrierRemittanceRouter.get("/carrier-remittance/:batchId/lines", requireRole("admin", "accounts_ops"), async (req, res) => {
  const batchId = req.params.batchId;
  if (!batchId) return sendError(res, 400, "invalid_request", "Missing batchId");
  try {
    const lines = await listCarrierRemittanceLines(batchId);
    res.json({ lines });
  } catch (err) {
    sendUnexpectedError(res, err, "carrier_remittance_lines_fetch_failed", "Could not load remittance lines.");
  }
});
