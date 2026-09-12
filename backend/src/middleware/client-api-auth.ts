import type { NextFunction, Request, Response } from "express";
import { supabase } from "../supabase/client.js";
import { hashApiKey } from "../lib/api-key.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiClient?: { clientId: string; keyId: string };
    }
  }
}

/**
 * Authenticates an external client system calling the /external/v1 API
 * surface, distinct from requireAuth (middleware/auth.ts) which validates an
 * internal ops user's Supabase session. Never trusts a client-supplied
 * client id — it's always derived from the key itself.
 */
export async function requireClientApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) {
    return res.status(401).json({ error: "unauthorized", message: "Missing bearer API key." });
  }

  const { data, error } = await supabase
    .from("client_api_keys")
    .select("id, client_id, active")
    .eq("key_hash", hashApiKey(token))
    .maybeSingle();

  if (error || !data || !data.active) {
    return res.status(401).json({ error: "unauthorized", message: "Invalid or inactive API key." });
  }

  req.apiClient = { clientId: data.client_id, keyId: data.id };

  // Best-effort - a failure here shouldn't block the actual request.
  void supabase.from("client_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);

  next();
}
