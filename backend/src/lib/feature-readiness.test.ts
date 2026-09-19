import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FEATURES,
  FeatureNotReadyError,
  UNVERIFIED_APIS_ENABLED,
  assertFeatureReady,
  featureNotReadyPayload,
  isFeatureActionEnabled,
  isOpsOnlyHidden,
  publicFeatureCatalog,
  UNVERIFIED_API_FEATURES,
} from "./feature-readiness.js";

describe("feature-readiness catalog", () => {
  it("keeps the Phase 1 golden path marked ready", () => {
    const ready = [
      "dashboard",
      "shipments",
      "createShipment",
      "rateCalculator",
      "bulkUpload",
    ] as const;
    for (const id of ready) {
      assert.equal(FEATURES[id].readiness, "ready");
      assert.equal(FEATURES[id].hideFromOpsOnly, false);
    }
  });

  it("hides unfinished carrier and billing surfaces from ops_only", () => {
    const gated = [
      "ndrQueue",
      "pickup",
      "label",
      "ndrReattempt",
      "reversePickup",
      "dtoRequests",
      "invoices",
      "vendorReconciliation",
      "cashReconciliation",
      "carrierRemittance",
      "clientLedger",
      "unicommerce",
    ] as const;
    for (const id of gated) {
      assert.equal(isOpsOnlyHidden(id), true);
      assert.notEqual(FEATURES[id].readiness, "ready");
    }
  });

  it("lists only unverified Delhivery-shaped calls as unverified_api", () => {
    assert.deepEqual(
      [...UNVERIFIED_API_FEATURES].sort(),
      ["dtoRequests", "label", "ndrReattempt", "pickup", "reversePickup"].sort(),
    );
  });

  it("FeatureNotReadyError names the feature and stays honest", () => {
    const err = new FeatureNotReadyError("pickup");
    assert.equal(err.code, "feature_not_ready");
    assert.equal(err.featureId, "pickup");
    assert.match(err.message, /not ready/i);
    assert.doesNotMatch(err.message, /\/fm\/request/);
  });

  it("disables unverified actions until the flag is flipped", () => {
    assert.equal(isFeatureActionEnabled("createShipment"), true);
    assert.equal(isFeatureActionEnabled("pickup"), false);
    assert.equal(isFeatureActionEnabled("invoices"), false);
  });

  it("keeps UNVERIFIED_APIS_ENABLED off so billing and carrier writes stay 501", () => {
    assert.equal(UNVERIFIED_APIS_ENABLED, false);
    for (const id of ["invoices", "pickup", "label", "ndrReattempt", "reversePickup"] as const) {
      assert.throws(() => assertFeatureReady(id), FeatureNotReadyError);
    }
  });

  it("invoice generate payload names the feature without leaking GST internals", () => {
    try {
      assertFeatureReady("invoices");
      assert.fail("expected FeatureNotReadyError");
    } catch (err) {
      assert.ok(err instanceof FeatureNotReadyError);
      const payload = featureNotReadyPayload(err);
      assert.equal(payload.error, "feature_not_ready");
      assert.equal(payload.feature, "invoices");
      assert.match(payload.message, /not ready/i);
      assert.doesNotMatch(payload.message, /INV\//);
    }
  });

  it("exposes a public catalog without dropping ids", () => {
    const catalog = publicFeatureCatalog();
    assert.equal(catalog.length, Object.keys(FEATURES).length);
    assert.ok(catalog.every((f) => f.id && f.reason));
  });

  it("capabilities payload entries have a valid readiness and matching id", () => {
    const allowed = new Set(["ready", "staging", "unverified_api"]);
    for (const entry of publicFeatureCatalog()) {
      assert.ok(allowed.has(entry.readiness), entry.id);
      assert.equal(entry.id, FEATURES[entry.id].id);
      assert.equal(typeof entry.hideFromOpsOnly, "boolean");
    }
    assert.equal(FEATURES.invoices.readiness, "staging");
    assert.equal(isFeatureActionEnabled("invoices"), false);
  });
});
