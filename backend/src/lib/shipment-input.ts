import { z } from "zod";

/** Indian PIN codes are 6 digits. Looser min-length checks let typos quote the wrong zone. */
export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Pincode must be a 6-digit Indian PIN code.");

export const dimensionsSchema = z.object({
  lengthCm: z.number().positive(),
  widthCm: z.number().positive(),
  heightCm: z.number().positive(),
});

export const paymentModeSchema = z.enum(["COD", "Prepaid"]);

export const rateCalculatorRequestSchema = z.object({
  originPincode: pincodeSchema,
  destinationPincode: pincodeSchema,
  weightGrams: z.number().positive(),
  dimensions: dimensionsSchema,
  paymentMode: paymentModeSchema,
  shipmentValueRupees: z.number().nonnegative().default(0),
});

export const createShipmentRequestSchema = rateCalculatorRequestSchema.extend({
  orderId: z.string().trim().min(1),
  clientId: z.string().uuid(),
  clientName: z.string().trim().min(1),
  addressLine: z.string().trim().min(1),
  city: z.string().trim().min(1),
  carrierCode: z.string().trim().min(1).default("delhivery"),
});

export function usesLocalBooking(carrierCode: string, delhiveryConfigured: boolean): boolean {
  return carrierCode === "delhivery" && !delhiveryConfigured;
}
