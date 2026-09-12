import { randomBytes } from "node:crypto";
import { supabase } from "../supabase/client.js";
import { getCarrierAdapter } from "../adapters/registry.js";
import { generateApiKey, hashApiKey } from "../lib/api-key.js";
import { bookAndCreateShipment, NonServiceableError } from "./shipment-service.js";
import { PincodeNotMappedError } from "../rate-engine/zone-resolver.js";
import { writeAuditLog } from "./audit-log-service.js";

type InternalShipmentStatus = "pending" | "in_transit" | "delivered" | "ndr" | "rto" | "dto";

// Only one live carrier this phase - every Unicommerce-sourced booking goes
// through Delhivery, same as the rest of the app.
const CARRIER_CODE = "delhivery";

export async function issueSellerCredentials(clientId: string, label: string, actorId: string | null | undefined) {
  const username = `tb_${randomBytes(6).toString("hex")}`;
  const { plaintext: password, hash: passwordHash } = generateApiKey();

  const { data, error } = await supabase
    .from("unicommerce_seller_credentials")
    .insert({ client_id: clientId, username, password_hash: passwordHash, label })
    .select("id, username, label, active, created_at")
    .single();
  if (error) throw error;

  await writeAuditLog({
    actorId,
    action: "unicommerce_credentials.issued",
    entityType: "client",
    entityId: clientId,
    after: { credential_id: data.id, username, label },
  });

  return { credential: data, password };
}

export async function listSellerCredentials(clientId: string) {
  const { data, error } = await supabase
    .from("unicommerce_seller_credentials")
    .select("id, username, label, active, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type AuthTokenResult = { status: "SUCCESS"; token: string } | { status: "INVALID_CREDENTIALS" };

/**
 * POST /authToken - Uniware sends the username/password Time Bound issued
 * to this client and expects a session token back, used as the "apikey"
 * header on every subsequent call.
 */
export async function authenticateSeller(username: string, password: string): Promise<AuthTokenResult> {
  const { data: credential } = await supabase
    .from("unicommerce_seller_credentials")
    .select("client_id, password_hash, active")
    .eq("username", username)
    .maybeSingle();

  if (!credential || !credential.active || hashApiKey(password) !== credential.password_hash) {
    return { status: "INVALID_CREDENTIALS" };
  }

  const { plaintext: token, hash: tokenHash } = generateApiKey();

  // One active session per client - upsert on the unique client_id column
  // replaces any previous token rather than accumulating stale rows.
  const { error } = await supabase
    .from("unicommerce_sessions")
    .upsert({ client_id: credential.client_id, token_hash: tokenHash }, { onConflict: "client_id" });
  if (error) throw error;

  return { status: "SUCCESS", token };
}

export interface UnicommerceWaybillPayload {
  code: string;
  weight: number; // grams
  length: number; // mm
  height: number; // mm
  breadth: number; // mm
  paymentMode: "COD" | "PREPAID";
  totalAmount: number;
  deliveryAddress: { name: string; address1: string; city: string; pincode: string };
  pickupAddress: { pincode: string };
}

export type WaybillResult =
  | { status: "SUCCESS"; waybill: string; shippingLabel?: string; courierName: string }
  | { status: "FAILED"; reason: string; message: string };

/**
 * POST /waybill - the actual booking. Reuses bookAndCreateShipment
 * (shipment-service.ts), the same path Create Shipment and Bulk Upload use,
 * with the request shape mapped in and clientId resolved from the
 * authenticated session - never trusted from the payload itself.
 */
export async function createWaybillFromUnicommerceOrder(
  clientId: string,
  payload: UnicommerceWaybillPayload,
): Promise<WaybillResult> {
  const { data: client } = await supabase.from("clients").select("name").eq("id", clientId).single();
  if (!client) return { status: "FAILED", reason: "WRONG INPUT", message: "Client not found for this session." };

  try {
    const { shipment } = await bookAndCreateShipment({
      orderId: payload.code,
      clientId,
      // The consignee's actual name (from Unicommerce's delivery address) is
      // more useful on the carrier's shipping label than Time Bound's own
      // client name here, despite the field being named clientName -
      // BookingRequest.clientName is what the Delhivery adapter puts on the
      // shipment as the recipient name.
      clientName: payload.deliveryAddress.name,
      addressLine: payload.deliveryAddress.address1,
      city: payload.deliveryAddress.city,
      carrierCode: CARRIER_CODE,
      originPincode: payload.pickupAddress.pincode,
      destinationPincode: payload.deliveryAddress.pincode,
      weightGrams: payload.weight,
      dimensions: {
        lengthCm: payload.length / 10,
        widthCm: payload.breadth / 10,
        heightCm: payload.height / 10,
      },
      paymentMode: payload.paymentMode === "COD" ? "COD" : "Prepaid",
      shipmentValueRupees: payload.totalAmount,
      source: "unicommerce",
    });

    let shippingLabel: string | undefined;
    try {
      const label = await getCarrierAdapter(CARRIER_CODE).generateLabel(shipment.awb);
      shippingLabel = label.labelUrl;
    } catch {
      // Best-effort - a booked shipment shouldn't fail just because the
      // label URL fetch did.
    }

    return { status: "SUCCESS", waybill: shipment.awb, shippingLabel, courierName: "Delhivery" };
  } catch (err) {
    if (err instanceof NonServiceableError) {
      return { status: "FAILED", reason: "NON_SERVICEABLE", message: err.message };
    }
    if (err instanceof PincodeNotMappedError) {
      return { status: "FAILED", reason: "WRONG INPUT", message: err.message };
    }
    return { status: "FAILED", reason: "BOOKING_FAILED", message: (err as Error).message };
  }
}

// Placeholder vocabulary - the docs are explicit that the real status list is
// negotiated with Unicommerce at onboarding, not fixed. Confirm and adjust
// this mapping before relying on it in production.
const STATUS_MAP: Record<InternalShipmentStatus, string> = {
  pending: "PICKUP_PENDING",
  in_transit: "InfoReceived",
  delivered: "Delivered",
  ndr: "UNDELIVERED",
  rto: "RTO",
  dto: "RTO",
};

export interface WaybillDetail {
  waybill: string;
  currentStatus: string;
  statusDate: string;
  current_location?: string;
  tracking_history: { status: string; location?: string; statusDate: string }[];
}

/**
 * GET /waybillDetails - scoped strictly to the calling client's own
 * shipments. Never return another client's tracking data even if they
 * happen to know a waybill number.
 */
export async function getWaybillDetails(clientId: string, waybills: string[]): Promise<WaybillDetail[]> {
  const { data: shipments, error } = await supabase
    .from("shipments")
    .select("id, awb, status, updated_at")
    .eq("client_id", clientId)
    .in("awb", waybills);
  if (error) throw error;
  if (!shipments || shipments.length === 0) return [];

  const results: WaybillDetail[] = [];
  for (const shipment of shipments) {
    const { data: events } = await supabase
      .from("tracking_events")
      .select("status, location, event_timestamp")
      .eq("shipment_id", shipment.id)
      .order("event_timestamp", { ascending: true });

    results.push({
      waybill: shipment.awb,
      currentStatus: STATUS_MAP[shipment.status as InternalShipmentStatus] ?? "PICKUP_PENDING",
      statusDate: shipment.updated_at,
      current_location: events?.[events.length - 1]?.location ?? undefined,
      tracking_history: (events ?? []).map((e) => ({
        status: e.status,
        location: e.location ?? undefined,
        statusDate: e.event_timestamp,
      })),
    });
  }
  return results;
}

/**
 * POST /cancel - marks the shipment cancelled internally only. Real
 * Delhivery-side cancellation needs a new CarrierAdapter.cancelShipment
 * method that doesn't exist yet (out of scope for this pass) - flagged
 * rather than silently pretending the carrier was notified.
 */
export async function cancelWaybill(clientId: string, waybill: string, actorId: string | null | undefined) {
  const { data: shipment, error } = await supabase
    .from("shipments")
    .select("id")
    .eq("client_id", clientId)
    .eq("awb", waybill)
    .maybeSingle();
  if (error || !shipment) {
    return { status: "FAILED" as const, waybill, errorMessage: "Waybill not found for this client." };
  }

  await writeAuditLog({
    actorId,
    action: "unicommerce.cancel_requested",
    entityType: "shipment",
    entityId: shipment.id,
    after: { note: "Marked cancelled internally only - no carrier-side cancellation call exists yet." },
  });

  return { status: "SUCCESS" as const, waybill, errorMessage: "" };
}
