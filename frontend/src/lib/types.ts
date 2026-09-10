export type PaymentMode = "COD" | "Prepaid";
export type ShipmentStatus = "pending" | "in_transit" | "delivered" | "ndr" | "rto";
export type ZoneSource = "api" | "lookup_table" | "computed";

export interface Client {
  id: string;
  name: string;
  contact_info: Record<string, unknown>;
  created_at: string;
}

export interface Carrier {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export interface Shipment {
  id: string;
  awb: string | null;
  order_id: string;
  client_id: string;
  carrier_id: string;
  origin_pincode: string;
  destination_pincode: string;
  weight_grams: number;
  chargeable_weight_grams: number;
  zone_code: string | null;
  zone_source: ZoneSource | null;
  payment_mode: PaymentMode;
  status: ShipmentStatus;
  cost_rupees: number | null;
  cod_charge_rupees: number;
  created_at: string;
  clients?: Pick<Client, "id" | "name"> | null;
  carriers?: Pick<Carrier, "id" | "name"> | null;
}

export interface DashboardKpis {
  total_shipments: number;
  revenue: number;
  delivered_pct: number;
  ndr_pct: number;
  rto_pct: number;
  cod_share_pct: number;
}

export interface DashboardTrendPoint {
  day: string;
  shipment_count: number;
  revenue: number;
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
