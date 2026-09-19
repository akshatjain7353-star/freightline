import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateCodChargeRupees, calculateSlabPriceRupees } from "./rate-card-calculator.js";

/** Zone A cells from supabase/seed.sql / reference-data/delhivery_rate_card.csv */
const ZONE_A = {
  flat_0_250: 25,
  flat_upto_500: 29,
  flat_upto_5000: 90,
  flat_upto_10000: 147,
  additional_500g_500_to_5000: 7,
  additional_1kg_5000_to_10000: 19,
  additional_1kg_beyond_10000: 13,
};

describe("calculateSlabPriceRupees (Delhivery Zone A)", () => {
  it("prices 0–250g and 250–500g as flats", () => {
    assert.equal(calculateSlabPriceRupees(200, ZONE_A), 25);
    assert.equal(calculateSlabPriceRupees(400, ZONE_A), 29);
  });

  it("prices 1kg in the 500g–5kg band (500g flat + one 500g increment)", () => {
    // 1000g → rounded to 1000; (1000-500)/500 = 1 → 29 + 7
    assert.equal(calculateSlabPriceRupees(1000, ZONE_A), 36);
  });
});

describe("calculateCodChargeRupees", () => {
  it("uses the 1% / ₹20 floor from the seeded rate card", () => {
    assert.equal(calculateCodChargeRupees(500, 1, 20), 20);
    assert.equal(calculateCodChargeRupees(5000, 1, 20), 50);
  });
});
