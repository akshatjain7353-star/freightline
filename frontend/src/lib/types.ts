export type PaymentMode = "COD" | "Prepaid";
export type ShipmentStatus = "pending" | "in_transit" | "delivered" | "ndr" | "rto" | "dto";
export type ZoneSource = "api" | "lookup_table" | "computed";
export type AppRole = "admin" | "accounts_ops" | "ops_only";
export type SettlementMode = "netted" | "separate";

export interface Client {
  id: string;
  name: string;
  contact_info: Record<string, unknown>;
  gstin: string | null;
  billing_state: string | null;
  settlement_mode: SettlementMode;
  created_at: string;
}

export interface Carrier {
  id: string;
  name: string;
  code: string;
  active: boolean;
  max_ndr_attempts: number;
}

// Read from `shipments_ops_view`, not the `shipments` table directly — the
// view masks cost_rupees/cod_charge_rupees to null for the ops_only role and
// denormalizes client/carrier names so no PostgREST embed is needed.
export type WeightDiscrepancyStatus = "flagged" | "accepted" | "disputed" | "resolved";
export type CodCollectionStatus = "pending" | "collected" | "remitted";

export interface Shipment {
  id: string;
  awb: string | null;
  order_id: string;
  client_id: string;
  carrier_id: string;
  client_name: string | null;
  carrier_name: string | null;
  origin_pincode: string;
  destination_pincode: string;
  destination_address_line: string | null;
  destination_city: string | null;
  weight_grams: number;
  chargeable_weight_grams: number;
  vendor_charged_weight: number | null;
  weight_discrepancy_flagged: boolean;
  weight_discrepancy_status: WeightDiscrepancyStatus | null;
  zone_code: string | null;
  zone_source: ZoneSource | null;
  payment_mode: PaymentMode;
  status: ShipmentStatus;
  cod_collection_status: CodCollectionStatus;
  rate_card_id: string | null;
  client_rate_card_id: string | null;
  related_shipment_id: string | null;
  ndr_attempt_count: number;
  cost_rupees: number | null;
  cod_charge_rupees: number | null;
  client_billed_amount: number | null;
  client_cod_charge_rupees: number | null;
  created_at: string;
}

export interface DashboardKpis {
  total_shipments: number;
  revenue: number | null;
  delivered_pct: number;
  ndr_pct: number;
  rto_pct: number;
  cod_share_pct: number;
}

export interface DashboardTrendPoint {
  day: string;
  shipment_count: number;
  revenue: number | null;
}

export interface CarrierDistributionPoint {
  carrier_name: string;
  shipment_count: number;
}

export interface Dimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface RateQuote {
  carrierCode: string;
  carrierName: string;
  zone: { zoneCode: string; source: ZoneSource };
  chargeableWeightGrams: number;
  baseCostRupees: number;
  codChargeRupees: number;
  fuelSurchargePercentApplied: number;
  totalCostRupees: number;
  source: "carrier_api" | "fallback_rate_card";
}
