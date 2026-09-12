import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth.js";
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
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
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
    res.status(500).json({ error: "carrier_remittance_reconciliation_failed", message: (err as Error).message });
  }
});

carrierRemittanceRouter.get("/carrier-remittance/:batchId/lines", requireRole("admin", "accounts_ops"), async (req, res) => {
  const batchId = req.params.batchId;
  if (!batchId) return res.status(400).json({ error: "invalid_request", message: "Missing batchId" });
  try {
    const lines = await listCarrierRemittanceLines(batchId);
    res.json({ lines });
  } catch (err) {
    res.status(500).json({ error: "carrier_remittance_lines_fetch_failed", message: (err as Error).message });
  }
});
