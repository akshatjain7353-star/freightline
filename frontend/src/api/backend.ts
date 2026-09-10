import type { Dimensions, PaymentMode, RateQuote } from "../lib/types";

const BASE_URL = import.meta.env.VITE_BACKEND_URL;

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message ?? data?.error ?? `Request to ${path} failed (${response.status})`);
  }
  return data as T;
}

export interface RateCalculatorInput {
  originPincode: string;
  destinationPincode: string;
  weightGrams: number;
  dimensions: Dimensions;
  paymentMode: PaymentMode;
  shipmentValueRupees: number;
}

export function calculateRates(input: RateCalculatorInput): Promise<{ quotes: RateQuote[] }> {
  return postJson("/api/rate-calculator", input);
}

export interface CreateShipmentInput extends RateCalculatorInput {
  orderId: string;
  clientId: string;
  clientName: string;
  addressLine: string;
  city: string;
  carrierCode: string;
}

export function createShipment(input: CreateShipmentInput) {
  return postJson("/api/shipments", input);
}

export interface BulkUploadRowResult {
  orderId: string;
  success: boolean;
  awb?: string;
  error?: string;
}

export function bulkUploadShipments(rows: CreateShipmentInput[]) {
  return postJson<{ total: number; successCount: number; failureCount: number; results: BulkUploadRowResult[] }>(
    "/api/bulk-upload",
    { rows },
  );
}
