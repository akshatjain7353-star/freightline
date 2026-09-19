import { Router } from "express";
import { sendError } from "../lib/http-error.js";
import { supabase } from "../supabase/client.js";
import { writeAuditLog } from "../services/audit-log-service.js";

export const exceptionsRouter = Router();

exceptionsRouter.get("/exceptions", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : "open";
  const { data, error } = await supabase
    .from("exception_log")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) {
    return sendError(res, 500, "exceptions_fetch_failed", "Could not load exceptions.");
  }
  res.json({ exceptions: data ?? [] });
});

exceptionsRouter.post("/exceptions/:id/resolve", async (req, res) => {
  const { data: exceptionRow, error } = await supabase
    .from("exception_log")
    .update({ status: "resolved", resolved_by: req.user?.id ?? null, resolved_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error || !exceptionRow) {
    return sendError(res, 404, "exception_not_found", "That exception was not found.");
  }

  await writeAuditLog({
    actorId: req.user?.id,
    action: "exception.resolved",
    entityType: "exception_log",
    entityId: req.params.id,
  });

  res.json({ exception: exceptionRow });
});
