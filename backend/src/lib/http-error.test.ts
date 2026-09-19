import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FeatureNotReadyError } from "./feature-readiness.js";
import { isUniqueViolation, publicErrorMessage, sendUnexpectedError, uniqueViolationConflict } from "./http-error.js";
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

  it("maps unique violations by constraint, not always to duplicate_order_id", () => {
    assert.deepEqual(
      uniqueViolationConflict(new Error('duplicate key value violates unique constraint "shipments_order_id_key"')),
      { code: "duplicate_order_id", message: "This order ID already exists. Use a different order ID." },
    );
    assert.deepEqual(
      uniqueViolationConflict({
        code: "23505",
        constraint: "client_invoices_invoice_number_key",
        message: "duplicate key value violates unique constraint",
      }),
      { code: "duplicate_invoice_number", message: "This invoice number already exists." },
    );
    assert.deepEqual(
      uniqueViolationConflict({
        code: "23505",
        details: "Key (external_reference)=(REF-1) already exists.",
      }),
      {
        code: "duplicate_external_reference",
        message: "This external reference already exists for the client.",
      },
    );
    assert.deepEqual(uniqueViolationConflict({ code: "23505", message: "duplicate key value" }), {
      code: "duplicate_record",
      message: "This record already exists.",
    });
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

  it("returns 409 duplicate_order_id only for shipments.order_id", () => {
    const res = mockRes();
    sendUnexpectedError(
      res,
      new Error('duplicate key value violates unique constraint "shipments_order_id_key"'),
      "shipment_creation_failed",
      "Could not save this shipment.",
    );
    assert.equal(res.statusCode, 409);
    const body = res.body as { error: string; message: string };
    assert.equal(body.error, "duplicate_order_id");
  });

  it("returns 409 duplicate_record for an unnamed unique violation", () => {
    const res = mockRes();
    sendUnexpectedError(res, { code: "23505", message: "duplicate key value" }, "vendor_reconciliation_failed", "Could not reconcile.");
    assert.equal(res.statusCode, 409);
    const body = res.body as { error: string; message: string };
    assert.equal(body.error, "duplicate_record");
    assert.equal(body.message, "This record already exists.");
  });
});
