import { delhiveryHttp } from "./client.js";
import type { PickupResult, SchedulePickupRequest } from "../../lib/types.js";

/**
 * POST /fm/request/new/ (Delhivery Pickup Request API).
 *
 * Endpoint path, request params, and response shape are unconfirmed against
 * real Delhivery docs/sandbox — same caution already applied elsewhere in
 * this adapter (the zone-classification API, the rate API's `ss` param).
 * Verify before relying on this for real pickups.
 */
export async function schedulePickup(request: SchedulePickupRequest): Promise<PickupResult> {
  const response = await delhiveryHttp.post("/fm/request/new/", {
    pickup_date: request.pickupDate,
    pickup_time: "10:00:00",
    pickup_location: request.pickupPincode,
    expected_package_count: 1,
  });

  return { carrierPickupId: response.data?.pickup_id ?? response.data?.data, raw: response.data };
}
