import { supabase } from "../supabase/client.js";
import { ClientScopeError, assertClientOwnsShipment, scopedClientId } from "../lib/client-scope.js";

export const CLIENT_SHIPMENTS_PAGE_SIZE = 50;

const CLIENT_SHIPMENT_COLUMNS =
  "id, awb, order_id, client_id, origin_pincode, destination_pincode, destination_address_line, destination_city, weight_grams, chargeable_weight_grams, payment_mode, status, created_at, updated_at, clients(name), carriers(name)";

export interface ClientShipmentRow {
  id: string;
  awb: string | null;
  order_id: string;
  client_id: string;
  client_name: string | null;
  carrier_name: string | null;
  origin_pincode: string;
  destination_pincode: string;
  destination_address_line: string | null;
  destination_city: string | null;
  weight_grams: number;
  chargeable_weight_grams: number;
  payment_mode: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: Record<string, unknown>): ClientShipmentRow {
  const clients = row.clients as { name?: string } | null;
  const carriers = row.carriers as { name?: string } | null;
  return {
    id: String(row.id),
    awb: (row.awb as string | null) ?? null,
    order_id: String(row.order_id),
    client_id: String(row.client_id),
    client_name: clients?.name ?? null,
    carrier_name: carriers?.name ?? null,
    origin_pincode: String(row.origin_pincode),
    destination_pincode: String(row.destination_pincode),
    destination_address_line: (row.destination_address_line as string | null) ?? null,
    destination_city: (row.destination_city as string | null) ?? null,
    weight_grams: Number(row.weight_grams),
    chargeable_weight_grams: Number(row.chargeable_weight_grams),
    payment_mode: String(row.payment_mode),
    status: String(row.status),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getClientProfile(userClientId: string | null | undefined) {
  const clientId = scopedClientId(userClientId);
  const { data, error } = await supabase.from("clients").select("id, name").eq("id", clientId).maybeSingle();
  if (error) throw error;
  return { clientId, clientName: data?.name ?? "Your account" };
}

export async function listClientShipments(
  userClientId: string | null | undefined,
  page = 0,
  search?: string,
) {
  const clientId = scopedClientId(userClientId);
  const from = page * CLIENT_SHIPMENTS_PAGE_SIZE;
  const to = from + CLIENT_SHIPMENTS_PAGE_SIZE - 1;

  let query = supabase
    .from("shipments")
    .select(CLIENT_SHIPMENT_COLUMNS, { count: "exact" })
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .range(from, to);

  const q = search?.trim();
  if (q) {
    query = query.or(`awb.ilike.%${q}%,order_id.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)), totalCount: count ?? 0 };
}

export async function getClientShipment(userClientId: string | null | undefined, shipmentId: string) {
  const clientId = scopedClientId(userClientId);
  const { data, error } = await supabase
    .from("shipments")
    .select(CLIENT_SHIPMENT_COLUMNS)
    .eq("id", shipmentId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new ClientScopeError("Shipment not found.");
  }
  const row = mapRow(data as Record<string, unknown>);
  assertClientOwnsShipment(row.client_id, clientId);
  return row;
}

export async function getClientShipmentTracking(userClientId: string | null | undefined, shipmentId: string) {
  await getClientShipment(userClientId, shipmentId);
  const { data, error } = await supabase
    .from("tracking_events")
    .select("id, status, event_timestamp, location")
    .eq("shipment_id", shipmentId)
    .order("event_timestamp", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
