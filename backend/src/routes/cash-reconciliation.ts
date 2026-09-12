import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../middleware/auth.js";
import { supabase } from "../supabase/client.js";
import { writeAuditLog } from "../services/audit-log-service.js";
import { getCashReconciliationRows } from "../services/cash-reconciliation-service.js";

export const cashReconciliationRouter = Router();

// Purely a money-reconciliation screen (invoice value, cash received,
// COD flow) - gated the same as the PATCH action below, rather than open to
// all authenticated like the operational list screens.
cashReconciliationRouter.get("/cash-reconciliation", requireRole("admin", "accounts_ops"), async (req, res) => {
  const page = Math.max(0, parseInt(String(req.query.page ?? "0"), 10) || 0);
  const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? "50"), 10) || 50));
  try {
    const result = await getCashReconciliationRows(
      {
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        carrierId: typeof req.query.carrierId === "string" ? req.query.carrierId : undefined,
        clientId: typeof req.query.clientId === "string" ? req.query.clientId : undefined,
        dateFrom: typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined,
        dateTo: typeof req.query.dateTo === "string" ? req.query.dateTo : undefined,
        search: typeof req.query.search === "string" ? req.query.search : undefined,
      },
      page,
      pageSize,
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "cash_reconciliation_fetch_failed", message: (err as Error).message });
  }
});

const statusSchema = z.object({ status: z.enum(["pending", "collected", "remitted"]) });

// Manual override — Stage C's carrier-remittance reconciliation is the
// normal path that sets this automatically when a batch line matches.
// Pricing-adjacent (touches money movement), so gated the same as rate
// cards rather than left open to all authenticated like weight/status
// operational fields.
cashReconciliationRouter.patch(
  "/shipments/:id/cod-collection-status",
  requireRole("admin", "accounts_ops"),
  async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    }

    const { data: before } = await supabase
      .from("shipments")
      .select("cod_collection_status")
      .eq("id", req.params.id)
      .maybeSingle();

    const { data: shipment, error } = await supabase
      .from("shipments")
      .update({ cod_collection_status: parsed.data.status })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error || !shipment) {
      return res.status(404).json({ error: "shipment_not_found", message: error?.message });
    }

    await writeAuditLog({
      actorId: req.user?.id,
      action: "shipment.cod_collection_status_changed",
      entityType: "shipment",
      entityId: req.params.id,
      before,
      after: { cod_collection_status: parsed.data.status },
    });

    res.json({ shipment });
  },
);
