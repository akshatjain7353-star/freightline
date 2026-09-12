import { Router } from "express";
import { z } from "zod";
import { supabase } from "../supabase/client.js";
import { writeAuditLog } from "../services/audit-log-service.js";

export const weightDiscrepanciesRouter = Router();

// Manual entry point for when the carrier's tracking payload doesn't carry a
// reweighed-weight field (see the caution comment in adapters/delhivery/tracking.ts).
// Writing vendor_charged_weight fires the DB trigger that computes the
// flat-10% discrepancy flag.
const vendorWeightSchema = z.object({ vendorChargedWeightGrams: z.number().positive() });

weightDiscrepanciesRouter.patch("/shipments/:id/vendor-weight", async (req, res) => {
  const parsed = vendorWeightSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }

  const { data: before } = await supabase
    .from("shipments")
    .select("vendor_charged_weight")
    .eq("id", req.params.id)
    .maybeSingle();

  const { data: shipment, error } = await supabase
    .from("shipments")
    .update({ vendor_charged_weight: parsed.data.vendorChargedWeightGrams })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error || !shipment) {
    return res.status(404).json({ error: "shipment_not_found", message: error?.message });
  }

  await writeAuditLog({
    actorId: req.user?.id,
    action: "shipment.vendor_weight_recorded",
    entityType: "shipment",
    entityId: req.params.id,
    before,
    after: { vendor_charged_weight: parsed.data.vendorChargedWeightGrams },
  });

  res.json({ shipment });
});

const statusSchema = z.object({ status: z.enum(["accepted", "disputed", "resolved"]) });

weightDiscrepanciesRouter.patch("/shipments/:id/weight-discrepancy-status", async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
  }

  const { data: before } = await supabase
    .from("shipments")
    .select("weight_discrepancy_status")
    .eq("id", req.params.id)
    .maybeSingle();

  const { data: shipment, error } = await supabase
    .from("shipments")
    .update({ weight_discrepancy_status: parsed.data.status })
    .eq("id", req.params.id)
    .select()
    .single();

  if (error || !shipment) {
    return res.status(404).json({ error: "shipment_not_found", message: error?.message });
  }

  await writeAuditLog({
    actorId: req.user?.id,
    action: "shipment.weight_discrepancy_status_changed",
    entityType: "shipment",
    entityId: req.params.id,
    before,
    after: { weight_discrepancy_status: parsed.data.status },
  });

  res.json({ shipment });
});
