import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth.js";
import { generateClientInvoice, listClientInvoices } from "../services/invoice-service.js";

export const invoicesRouter = Router();

invoicesRouter.get("/invoices", requireRole("admin", "accounts_ops"), async (req, res) => {
  try {
    const clientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
    const invoices = await listClientInvoices(clientId);
    res.json({ invoices });
  } catch (err) {
    res.status(500).json({ error: "invoices_fetch_failed", message: (err as Error).message });
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
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  try {
    const invoice = await generateClientInvoice(
      parsed.data.clientId,
      parsed.data.periodFrom,
      parsed.data.periodTo,
      req.user?.id,
    );
    res.status(201).json({ invoice });
  } catch (err) {
    res.status(500).json({ error: "invoice_generation_failed", message: (err as Error).message });
  }
});
