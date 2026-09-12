import type { NextFunction, Request, Response } from "express";
import { supabase } from "../supabase/client.js";
import { hashApiKey } from "../lib/api-key.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      unicommerceClient?: { clientId: string };
    }
  }
}

/**
 * Authenticates a Uniware call using the session token issued by
 * /authToken, carried in the "apikey" header (Unicommerce's own header
 * name, not "Authorization: Bearer" like the other two auth surfaces in
 * this app). Deliberately not applied to /authToken itself, which is what
 * bootstraps this session in the first place.
 */
export async function requireUnicommerceToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.apikey;
  const tokenString = Array.isArray(token) ? token[0] : token;
  if (!tokenString) {
    return res.status(401).json({ status: "FAILED", reason: "UNAUTHORIZED", message: "Missing apikey header." });
  }

  const { data, error } = await supabase
    .from("unicommerce_sessions")
    .select("client_id")
    .eq("token_hash", hashApiKey(tokenString))
    .maybeSingle();

  if (error || !data) {
    return res.status(401).json({ status: "FAILED", reason: "UNAUTHORIZED", message: "Invalid or expired token." });
  }

  req.unicommerceClient = { clientId: data.client_id };
  next();
}
