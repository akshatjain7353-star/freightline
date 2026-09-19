import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createShipmentRequestSchema,
  pincodeSchema,
  rateCalculatorRequestSchema,
  usesLocalBooking,
} from "./shipment-input.js";

const dimensions = { lengthCm: 10, widthCm: 10, heightCm: 10 };

describe("pincodeSchema", () => {
  it("accepts a 6-digit PIN", () => {
    assert.equal(pincodeSchema.parse("110001"), "110001");
    assert.equal(pincodeSchema.parse(" 400001 "), "400001");
  });

  it("rejects short, long, or non-digit PINs", () => {
    assert.equal(pincodeSchema.safeParse("1100").success, false);
    assert.equal(pincodeSchema.safeParse("1100011").success, false);
    assert.equal(pincodeSchema.safeParse("11000a").success, false);
  });
});

describe("rateCalculatorRequestSchema", () => {
  it("accepts a Phase 1 quote payload", () => {
    const parsed = rateCalculatorRequestSchema.parse({
      originPincode: "110001",
      destinationPincode: "400001",
      weightGrams: 1000,
      dimensions,
      paymentMode: "Prepaid",
      shipmentValueRupees: 500,
    });
    assert.equal(parsed.originPincode, "110001");
    assert.equal(parsed.weightGrams, 1000);
  });

  it("rejects an incomplete quote", () => {
    assert.equal(rateCalculatorRequestSchema.safeParse({ originPincode: "110001" }).success, false);
  });
});

describe("createShipmentRequestSchema", () => {
  it("requires client and address fields", () => {
    const parsed = createShipmentRequestSchema.parse({
      orderId: "ORD-1",
      clientId: "00000000-0000-0000-0000-000000000201",
      clientName: "Test Client",
      addressLine: "1 Sample Street",
      city: "Delhi",
      originPincode: "110001",
      destinationPincode: "400001",
      weightGrams: 1000,
      dimensions,
      paymentMode: "COD",
      shipmentValueRupees: 500,
    });
    assert.equal(parsed.carrierCode, "delhivery");
    assert.equal(parsed.paymentMode, "COD");
  });
});

describe("usesLocalBooking", () => {
  it("saves locally only when Delhivery is the carrier and no key is configured", () => {
    assert.equal(usesLocalBooking("delhivery", false), true);
    assert.equal(usesLocalBooking("delhivery", true), false);
    assert.equal(usesLocalBooking("xpressbees", false), false);
  });
});
