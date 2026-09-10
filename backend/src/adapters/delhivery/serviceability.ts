import { delhiveryHttp } from "./client.js";
import type { ServiceabilityResult } from "../../lib/types.js";

/**
 * GET /c/api/pin-codes/json/?filter_codes=<pincode>
 * An empty response list means the pincode is non-serviceable (NSZ).
 */
export async function checkServiceability(pincode: string): Promise<ServiceabilityResult> {
  const response = await delhiveryHttp.get("/c/api/pin-codes/json/", {
    params: { filter_codes: pincode },
  });

  const results = response.data?.delivery_codes ?? response.data ?? [];
  const serviceable = Array.isArray(results) && results.length > 0;

  return { pincode, serviceable, raw: response.data };
}
