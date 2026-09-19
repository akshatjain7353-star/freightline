import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FEATURES,
  FeatureNotReadyError,
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

  it("exposes a public catalog without dropping ids", () => {
    const catalog = publicFeatureCatalog();
    assert.equal(catalog.length, Object.keys(FEATURES).length);
    assert.ok(catalog.every((f) => f.id && f.reason));
  });
});
