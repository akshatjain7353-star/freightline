import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FeatureNotReadyError } from "./feature-readiness.js";
import { isUniqueViolation, publicErrorMessage, sendUnexpectedError } from "./http-error.js";
import type { Response } from "express";

function mockRes() {
  const res = {
    statusCode: 0,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as typeof res & Response;
}

describe("publicErrorMessage", () => {
  it("passes through feature-not-ready copy", () => {
    const err = new FeatureNotReadyError("pickup");
    assert.match(publicErrorMessage(err, "fallback"), /not ready/i);
  });

  it("rewrites unique-constraint leaks into an ops-safe sentence", () => {
    const err = new Error('duplicate key value violates unique constraint "shipments_order_id_key"');
    assert.equal(isUniqueViolation(err), true);
    assert.equal(
      publicErrorMessage(err, "Could not save shipment."),
      "This order ID already exists. Use a different order ID.",
    );
  });

  it("does not leak postgres / connection internals", () => {
    assert.equal(publicErrorMessage(new Error("ECONNREFUSED 127.0.0.1:5432"), "Could not quote."), "Could not quote.");
    assert.equal(
      publicErrorMessage(new Error("PGRST116: JSON could not be generated"), "Could not quote."),
      "Could not quote.",
    );
  });

  it("keeps short domain messages", () => {
    assert.equal(
      publicErrorMessage(new Error("Carrier delhivery not found in carriers table"), "Could not save."),
      "Carrier delhivery not found in carriers table",
    );
  });
});

describe("sendUnexpectedError on billing / gated routes", () => {
  it("returns 501 feature_not_ready for invoice generate while the flag is off", () => {
    const res = mockRes();
    sendUnexpectedError(res, new FeatureNotReadyError("invoices"), "invoice_generation_failed", "Could not generate.");
    assert.equal(res.statusCode, 501);
    const body = res.body as { error: string; feature: string; message: string };
    assert.equal(body.error, "feature_not_ready");
    assert.equal(body.feature, "invoices");
    assert.match(body.message, /not ready/i);
    assert.doesNotMatch(JSON.stringify(body), /postgres|JWT|stack/i);
  });

  it("sanitizes driver leaks on a vendor-recon style 500", () => {
    const res = mockRes();
    sendUnexpectedError(
      res,
      new Error("PGRST204: Could not find the 'vendor_invoice_lines' resource in the schema cache"),
      "vendor_reconciliation_failed",
      "Could not reconcile this vendor invoice.",
    );
    assert.equal(res.statusCode, 500);
    const body = res.body as { error: string; message: string };
    assert.equal(body.error, "vendor_reconciliation_failed");
    assert.equal(body.message, "Could not reconcile this vendor invoice.");
    assert.doesNotMatch(JSON.stringify(body), /PGRST|schema cache/i);
  });

  it("does not leak JWT text from a ledger fetch", () => {
    const res = mockRes();
    sendUnexpectedError(res, new Error("JWT expired at 2026-01-01"), "client_ledger_fetch_failed", "Could not load this client's ledger.");
    assert.equal(res.statusCode, 500);
    const body = res.body as { error: string; message: string };
    assert.equal(body.error, "client_ledger_fetch_failed");
    assert.equal(body.message, "Could not load this client's ledger.");
  });
});
