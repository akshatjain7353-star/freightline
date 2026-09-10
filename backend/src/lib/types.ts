export type PaymentMode = "COD" | "Prepaid";

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

export interface TrackingUpdate {
  awb: string;
  status: string;
  eventTimestamp: string;
  location?: string;
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
}
