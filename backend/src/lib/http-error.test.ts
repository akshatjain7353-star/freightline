import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FeatureNotReadyError } from "./feature-readiness.js";
import { isUniqueViolation, publicErrorMessage } from "./http-error.js";

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
