export type PaymentMode = "COD" | "Prepaid";

export type AppRole = "admin" | "accounts_ops" | "ops_only";

export type ZoneSource = "api" | "lookup_table" | "computed";

export type ZoneCode = "A" | "B" | "C1" | "C2" | "D1" | "D2" | "E" | "F";

export interface Dimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface ZoneResolution {
  zoneCode: ZoneCode;
  source: ZoneSource;
}

export interface RateQuote {
  carrierCode: string;
  carrierName: string;
  zone: ZoneResolution;
  chargeableWeightGrams: number;
  baseCostRupees: number;
  codChargeRupees: number;
  fuelSurchargePercentApplied: number;
  totalCostRupees: number;
  source: "carrier_api" | "fallback_rate_card";
  /** The rate card version active when this quote was produced — persisted onto the shipment for auditability. */
  rateCardId: string;
}

export interface ServiceabilityResult {
  pincode: string;
  serviceable: boolean;
  raw?: unknown;
}

export interface BookingRequest {
  orderId: string;
  clientName: string;
  addressLine: string;
  city: string;
  originPincode: string;
  destinationPincode: string;
  weightGrams: number;
  dimensions: Dimensions;
  paymentMode: PaymentMode;
  shipmentValueRupees: number;
}

export interface BookingResult {
  awb: string;
  raw: unknown;
}

export interface SchedulePickupRequest {
  awb: string;
  pickupDate: string; // YYYY-MM-DD
  pickupPincode: string;
}

export interface PickupResult {
  carrierPickupId?: string;
  raw: unknown;
}

export interface LabelResult {
  labelUrl?: string;
  raw: unknown;
}

export interface ReversePickupRequest {
  orderId: string;
  clientName: string;
  addressLine: string;
  city: string;
  /** Where the carrier collects the return from — the original destination. */
  pickupPincode: string;
  /** Time Bound's return-to destination. */
  destinationPincode: string;
  weightGrams: number;
  dimensions: Dimensions;
  shipmentValueRupees: number;
  pickupDate: string;
}

export interface TrackingUpdate {
  awb: string;
  status: string;
  eventTimestamp: string;
  location?: string;
  /** Vendor-reweighed chargeable weight, when the carrier's payload includes it. */
  vendorChargedWeightGrams?: number;
  raw: unknown;
}

/**
 * Common interface every carrier adapter implements, so Xpressbees/Ekart can
 * plug in later without touching the rate engine, routes, or the poller.
 */
export interface CarrierAdapter {
  code: string;
  name: string;
  getRateQuote(params: {
    originPincode: string;
    destinationPincode: string;
    weightGrams: number;
    dimensions: Dimensions;
    paymentMode: PaymentMode;
    shipmentValueRupees: number;
  }): Promise<RateQuote>;
  checkServiceability(pincode: string): Promise<ServiceabilityResult>;
  createShipment(request: BookingRequest): Promise<BookingResult>;
  trackShipments(awbs: string[]): Promise<TrackingUpdate[]>;
  schedulePickup(request: SchedulePickupRequest): Promise<PickupResult>;
  generateLabel(awb: string): Promise<LabelResult>;
  /** Reverse pickup is a brand-new booking (own AWB), not a status change on the original shipment. */
  scheduleReversePickup(request: ReversePickupRequest): Promise<BookingResult>;
  requestNdrReattempt(awb: string): Promise<void>;
}
