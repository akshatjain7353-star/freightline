import { delhiveryHttp } from "./client.js";

/**
 * POST /api/p/update (Delhivery NDR reattempt request).
 *
 * Endpoint path and request shape are unconfirmed against real Delhivery
 * docs/sandbox — verify before relying on this for real reattempt requests.
 */
export async function requestNdrReattempt(awb: string): Promise<void> {
  await delhiveryHttp.post("/api/p/update", {
    data: [{ waybill: awb, act: "RE-ATTEMPT" }],
  });
}
