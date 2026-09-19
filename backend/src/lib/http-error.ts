import type { Response } from "express";
import { FeatureNotReadyError, featureNotReadyPayload } from "./feature-readiness.js";

const LEAKY_PATTERN =
  /postgres|duplicate key|unique constraint|violates|PGRST|JWT|ECONNREFUSED|ENOTFOUND|supabase|stack|at Object\.|node_modules/i;

export function isUniqueViolation(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const code = typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code) : "";
  return code === "23505" || /duplicate key|unique constraint/i.test(message);
}

/**
 * Safe message for JSON responses. Expected domain errors pass through;
 * driver/DB/stack text is replaced so ops never see internals.
 */
export function publicErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof FeatureNotReadyError) return err.message;
  if (err && typeof err === "object" && "name" in err) {
    const name = String((err as { name?: string }).name);
    if (name === "PincodeNotMappedError" || name === "NonServiceableError") {
      return err instanceof Error ? err.message : fallback;
    }
  }
  if (isUniqueViolation(err)) {
    return "This order ID already exists. Use a different order ID.";
  }
  const message = err instanceof Error ? err.message : "";
  if (!message || message.length > 240 || message.includes("\n") || LEAKY_PATTERN.test(message)) {
    return fallback;
  }
  return message;
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  res.status(status).json({ error: code, message, ...extra });
}

export function sendUnexpectedError(res: Response, err: unknown, code: string, fallback: string) {
  if (err instanceof FeatureNotReadyError) {
    return res.status(501).json(featureNotReadyPayload(err));
  }
  if (isUniqueViolation(err)) {
    return sendError(res, 409, "duplicate_order_id", publicErrorMessage(err, fallback));
  }
  sendError(res, 500, code, publicErrorMessage(err, fallback));
}
