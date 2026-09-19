import type { Response } from "express";
import { FeatureNotReadyError, featureNotReadyPayload } from "./feature-readiness.js";

const LEAKY_PATTERN =
  /postgres|duplicate key|unique constraint|violates|PGRST|JWT|ECONNREFUSED|ENOTFOUND|supabase|stack|at Object\.|node_modules/i;

export function isUniqueViolation(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const code = typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code) : "";
  return code === "23505" || /duplicate key|unique constraint/i.test(message);
}

function uniqueConstraintHint(err: unknown): string {
  if (typeof err === "object" && err) {
    const constraint = "constraint" in err ? String((err as { constraint?: string }).constraint ?? "") : "";
    const details = "details" in err ? String((err as { details?: string }).details ?? "") : "";
    if (constraint) return `${constraint} ${details}`;
    if (details) return details;
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Map a unique-constraint failure to a public 409 code + message.
 * Only shipments.order_id uses duplicate_order_id; everything else is
 * a specific known column or a generic duplicate_record.
 */
export function uniqueViolationConflict(err: unknown): { code: string; message: string } {
  const hint = uniqueConstraintHint(err);
  if (/shipments_order_id|Key \(order_id\)/i.test(hint)) {
    return { code: "duplicate_order_id", message: "This order ID already exists. Use a different order ID." };
  }
  if (/invoice_number|Key \(invoice_number\)/i.test(hint)) {
    return { code: "duplicate_invoice_number", message: "This invoice number already exists." };
  }
  if (/external_reference|uq_dto_requests_client_external_reference/i.test(hint)) {
    return {
      code: "duplicate_external_reference",
      message: "This external reference already exists for the client.",
    };
  }
  return { code: "duplicate_record", message: "This record already exists." };
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
    return uniqueViolationConflict(err).message;
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
    const conflict = uniqueViolationConflict(err);
    return sendError(res, 409, conflict.code, conflict.message);
  }
  sendError(res, 500, code, publicErrorMessage(err, fallback));
}
