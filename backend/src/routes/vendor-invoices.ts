import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth.js";
import { listVendorInvoiceBatchLines, reconcileVendorInvoice } from "../services/vendor-reconciliation-service.js";

export const vendorInvoicesRouter = Router();

// Rows are parsed CSV -> JSON client-side, mirroring the existing bulk-upload
// pattern (frontend uses papaparse; the backend never touches raw CSV text).
const uploadSchema = z.object({
  carrierCode: z.string().min(1).default("delhivery"),
  fileName: z.string().optional(),
  rows: z
    .array(z.object({ awb: z.string().min(1), vendorBilledAmountRupees: z.number().nonnegative() }))
    .min(1)
    .max(2000),
});

vendorInvoicesRouter.post("/vendor-invoices/reconcile", requireRole("admin", "accounts_ops"), async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  try {
    const result = await reconcileVendorInvoice(
      parsed.data.carrierCode,
      parsed.data.rows,
      parsed.data.fileName,
      req.user?.id,
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: "vendor_reconciliation_failed", message: (err as Error).message });
  }
});

vendorInvoicesRouter.get("/vendor-invoices/:batchId/lines", requireRole("admin", "accounts_ops"), async (req, res) => {
  const batchId = req.params.batchId;
  if (!batchId) return res.status(400).json({ error: "invalid_request", message: "Missing batchId" });
  try {
    const lines = await listVendorInvoiceBatchLines(batchId);
    res.json({ lines });
  } catch (err) {
    res.status(500).json({ error: "vendor_invoice_lines_fetch_failed", message: (err as Error).message });
  }
});
