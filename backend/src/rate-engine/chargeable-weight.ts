import type { Dimensions } from "../lib/types.js";

/**
 * volumetric_weight_grams = (L_cm x W_cm x H_cm / 5000) x 1000
 * chargeable_weight = max(actual_weight_grams, volumetric_weight_grams)
 */
export function calculateChargeableWeightGrams(actualWeightGrams: number, dimensions: Dimensions): number {
  const volumetricWeightGrams =
    ((dimensions.lengthCm * dimensions.widthCm * dimensions.heightCm) / 5000) * 1000;
  return Math.max(actualWeightGrams, volumetricWeightGrams);
}
