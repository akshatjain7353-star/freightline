import { supabase } from "../supabase/client.js";

export async function writeAuditLog(entry: {
  actorId: string | null | undefined;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  const { error } = await supabase.from("audit_log").insert({
    actor_id: entry.actorId ?? null,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
  // Audit logging must never break the calling mutation — log and move on.
  if (error) console.error("Failed to write audit log:", error);
}
