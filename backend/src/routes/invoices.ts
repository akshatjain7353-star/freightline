import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth.js";
import { generateClientInvoice, listClientInvoices } from "../services/invoice-service.js";
import { assertFeatureReady } from "../lib/feature-readiness.js";
import { sendError, sendUnexpectedError } from "../lib/http-error.js";

export const invoicesRouter = Router();

invoicesRouter.get("/invoices", requireRole("admin", "accounts_ops"), async (req, res) => {
  try {
    const clientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
    const invoices = await listClientInvoices(clientId);
    res.json({ invoices });
  } catch (err) {
    sendUnexpectedError(res, err, "invoices_fetch_failed", "Could not load invoices.");
  }
});

const generateSchema = z.object({
  clientId: z.string().uuid(),
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "periodFrom must be YYYY-MM-DD"),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "periodTo must be YYYY-MM-DD"),
});

invoicesRouter.post("/invoices", requireRole("admin", "accounts_ops"), async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "Check client and invoice period dates.", {
      details: parsed.error.flatten(),
    });
  }
  try {
    // Implementation stays in invoice-service.ts. GST rate / IGST split are
    // unconfirmed — do not emit filing documents until those are signed off.
    assertFeatureReady("invoices");
    const invoice = await generateClientInvoice(
      parsed.data.clientId,
      parsed.data.periodFrom,
      parsed.data.periodTo,
      req.user?.id,
    );
    res.status(201).json({ invoice });
  } catch (err) {
    sendUnexpectedError(res, err, "invoice_generation_failed", "Could not generate this invoice.");
  }
});
