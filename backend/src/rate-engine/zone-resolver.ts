import axios from "axios";
import { supabase } from "../supabase/client.js";
import { haversineDistanceKm } from "../lib/haversine.js";
import { env } from "../config/env.js";
import type { ZoneCode, ZoneResolution } from "../lib/types.js";

export class PincodeNotMappedError extends Error {
  constructor(public readonly pincode: string) {
    super(
      `Pincode ${pincode} is not in pincode_master. Zone Path 3 (computed fallback) cannot ` +
        `classify it without a lat/lng entry. Add it to pincode_master, or load a real ` +
        `pincode_zone_map / zone API before quoting this route.`,
    );
    this.name = "PincodeNotMappedError";
  }
}

interface PincodeRow {
  pincode: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  is_metro: boolean;
}

// The spec's E/F destination lists are given as a mix of states and named
// regions (e.g. "Jammu" vs "Kashmir" split out of the same state). This is an
// approximation matched against pincode_master's city/state columns — review
// and adjust against real Delhivery zone data before trusting it in
// production. Values are lowercased for case-insensitive matching.
const ZONE_F_STATES = ["andaman and nicobar islands", "manipur"];
const ZONE_F_CITY_KEYWORDS = ["leh", "ladakh", "kashmir"];

const ZONE_E_STATES = [
  "assam",
  "arunachal pradesh",
  "meghalaya",
  "mizoram",
  "nagaland",
  "tripura",
  "sikkim",
  "himachal pradesh",
  "uttarakhand",
];
const ZONE_E_CITY_KEYWORDS = ["jammu"];

function matchesSpecialZone(row: PincodeRow, states: string[], cityKeywords: string[]): boolean {
  const state = row.state.toLowerCase();
  const city = row.city.toLowerCase();
  if (states.includes(state)) return true;
  return cityKeywords.some((keyword) => city.includes(keyword));
}

async function resolveViaApi(originPincode: string, destinationPincode: string): Promise<ZoneResolution | null> {
  if (!env.DELHIVERY_ZONE_API_PATH) return null;

  // Path 1: an explicit zone-classification endpoint, if Delhivery exposes
  // one. Unconfirmed — DELHIVERY_ZONE_API_PATH is left unset by default.
  // Validate the response shape against sandbox before relying on this.
  const response = await axios.get(env.DELHIVERY_ZONE_API_PATH, {
    params: { o_pin: originPincode, d_pin: destinationPincode },
    headers: { Authorization: `Token ${env.DELHIVERY_API_KEY}` },
  });

  const zoneCode = response.data?.zone as ZoneCode | undefined;
  if (!zoneCode) return null;
  return { zoneCode, source: "api" };
}

async function resolveViaLookupTable(
  originPincode: string,
  destinationPincode: string,
): Promise<ZoneResolution | null> {
  const { data, error } = await supabase
    .from("pincode_zone_map")
    .select("zone_code")
    .eq("origin_pincode", originPincode)
    .eq("destination_pincode", destinationPincode)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { zoneCode: data.zone_code as ZoneCode, source: "lookup_table" };
}

async function resolveViaComputedFallback(
  originPincode: string,
  destinationPincode: string,
): Promise<ZoneResolution> {
  // Identical pincode is trivially the same city (Zone A) regardless of
  // whether we have lat/lng data for it — no need to consult pincode_master.
  if (originPincode === destinationPincode) {
    return { zoneCode: "A", source: "computed" };
  }

  const { data, error } = await supabase
    .from("pincode_master")
    .select("pincode, city, state, lat, lng, is_metro")
    .in("pincode", [originPincode, destinationPincode]);

  if (error) throw error;

  const rows = (data ?? []) as PincodeRow[];
  const origin = rows.find((r) => r.pincode === originPincode);
  const destination = rows.find((r) => r.pincode === destinationPincode);

  if (!origin) throw new PincodeNotMappedError(originPincode);
  if (!destination) throw new PincodeNotMappedError(destinationPincode);

  // Destination-region special cases take priority per spec, checked before
  // distance bands. F checked first since Manipur overlaps the North-East
  // list used for E.
  if (matchesSpecialZone(destination, ZONE_F_STATES, ZONE_F_CITY_KEYWORDS)) {
    return { zoneCode: "F", source: "computed" };
  }
  if (matchesSpecialZone(destination, ZONE_E_STATES, ZONE_E_CITY_KEYWORDS)) {
    return { zoneCode: "E", source: "computed" };
  }

  if (origin.city.toLowerCase() === destination.city.toLowerCase()) {
    return { zoneCode: "A", source: "computed" };
  }

  const distanceKm = haversineDistanceKm(origin, destination);
  const bothMetro = origin.is_metro && destination.is_metro;

  if (distanceKm <= 500) {
    return { zoneCode: "B", source: "computed" };
  }
  if (distanceKm <= 1400) {
    return { zoneCode: bothMetro ? "C1" : "D1", source: "computed" };
  }
  // Spec bands top out at 2500km; anything beyond is bucketed into the
  // farthest defined band (C2/D2) rather than left unresolved.
  return { zoneCode: bothMetro ? "C2" : "D2", source: "computed" };
}

/**
 * Resolves the Delhivery zone for a pincode pair, trying:
 * 1. A live zone-classification API (if DELHIVERY_ZONE_API_PATH is set)
 * 2. A static origin/destination -> zone lookup table (pincode_zone_map)
 * 3. Computed distance/metro-based fallback (pincode_master)
 *
 * Throws PincodeNotMappedError if Path 3 is reached and either pincode is
 * missing from pincode_master — callers should surface this as a 422, never
 * guess a zone.
 */
export async function resolveZone(originPincode: string, destinationPincode: string): Promise<ZoneResolution> {
  const viaApi = await resolveViaApi(originPincode, destinationPincode);
  if (viaApi) return viaApi;

  const viaLookup = await resolveViaLookupTable(originPincode, destinationPincode);
  if (viaLookup) return viaLookup;

  return resolveViaComputedFallback(originPincode, destinationPincode);
}
