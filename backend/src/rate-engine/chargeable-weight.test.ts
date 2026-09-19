import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateChargeableWeightGrams } from "./chargeable-weight.js";

describe("calculateChargeableWeightGrams", () => {
  it("uses actual weight when it is heavier than volumetric", () => {
    assert.equal(calculateChargeableWeightGrams(2000, { lengthCm: 10, widthCm: 10, heightCm: 10 }), 2000);
  });

  it("uses volumetric weight (L*W*H/5000*1000) when it is heavier", () => {
    // 50*40*40 / 5000 * 1000 = 16_000g
    assert.equal(calculateChargeableWeightGrams(500, { lengthCm: 50, widthCm: 40, heightCm: 40 }), 16_000);
  });
});
