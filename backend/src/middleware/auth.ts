import type { NextFunction, Request, Response } from "express";
import { supabase } from "../supabase/client.js";
import type { AppRole } from "../lib/types.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string | null; role: AppRole | null };
    }
  }
}

/**
 * Validates the caller's Supabase JWT and attaches their app role (looked up
 * via the service-role client, which bypasses RLS — the backend is the
 * trusted party doing this check, not the end user).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) {
    return res.status(401).json({ error: "unauthorized", message: "Missing bearer token." });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: "unauthorized", message: "Invalid or expired session." });
  }

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  req.user = { id: data.user.id, email: data.user.email ?? null, role: (roleRow?.role as AppRole) ?? null };
  next();
}

export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "forbidden", message: "You don't have access to this action." });
    }
    next();
  };
}
