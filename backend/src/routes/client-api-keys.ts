import { Router } from "express";
import { z } from "zod";
import { sendError } from "../lib/http-error.js";
import { supabase } from "../supabase/client.js";
import { generateApiKey } from "../lib/api-key.js";
import { requireRole } from "../middleware/auth.js";
import { writeAuditLog } from "../services/audit-log-service.js";

export const clientApiKeysRouter = Router();

// Credential issuance is admin-only, stricter than the pricing-tier routes
// (rate-cards, client-rate-cards) which allow accounts_ops too.
clientApiKeysRouter.use(requireRole("admin"));

clientApiKeysRouter.get("/clients/:id/api-keys", async (req, res) => {
  const { data, error } = await supabase
    .from("client_api_keys")
    .select("id, label, active, created_at, last_used_at")
    .eq("client_id", req.params.id)
    .order("created_at", { ascending: false });
  if (error) {
    return sendError(res, 500, "api_keys_fetch_failed", "Could not load API keys.");
  }
  res.json({ apiKeys: data ?? [] });
});

const generateSchema = z.object({ label: z.string().min(1) });

clientApiKeysRouter.post("/clients/:id/api-keys", async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "invalid_request", "A label is required to issue an API key.", {
      details: parsed.error.flatten(),
    });
  }

  const { plaintext, hash } = generateApiKey();
  const { data, error } = await supabase
    .from("client_api_keys")
    .insert({ client_id: req.params.id, key_hash: hash, label: parsed.data.label })
    .select("id, label, active, created_at")
    .single();
  if (error) {
    return sendError(res, 500, "api_key_generation_failed", "Could not issue this API key.");
  }

  await writeAuditLog({
    actorId: req.user?.id,
    action: "client_api_key.generated",
    entityType: "client",
    entityId: req.params.id,
    after: { api_key_id: data.id, label: data.label },
  });

  // The only time the plaintext key is ever returned — callers must copy it now.
  res.status(201).json({ apiKey: data, plaintext });
});

clientApiKeysRouter.post("/api-keys/:id/revoke", async (req, res) => {
  const { data, error } = await supabase
    .from("client_api_keys")
    .update({ active: false })
    .eq("id", req.params.id)
    .select("id, client_id")
    .single();
  if (error || !data) {
    return sendError(res, 404, "api_key_not_found", "That API key was not found.");
  }

  await writeAuditLog({
    actorId: req.user?.id,
    action: "client_api_key.revoked",
    entityType: "client",
    entityId: data.client_id,
    after: { api_key_id: data.id },
  });

  res.json({ ok: true });
});
