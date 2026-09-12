import type { Dimensions, PaymentMode, RateQuote, SettlementMode, Shipment } from "../lib/types";
import { getAccessToken } from "../lib/supabase";

const BASE_URL = import.meta.env.VITE_BACKEND_URL;

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message ?? data?.error ?? `Request to ${path} failed (${response.status})`);
  }
  return data as T;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { headers: await authHeaders() });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message ?? data?.error ?? `Request to ${path} failed (${response.status})`);
  }
  return data as T;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
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

export interface ServiceabilityResult {
  pincode: string;
  serviceable: boolean;
  error?: string;
}

export function checkServiceability(destinationPincode: string, carrierCode = "delhivery") {
  return postJson<ServiceabilityResult>("/api/serviceability-check", { destinationPincode, carrierCode });
}

export function checkServiceabilityBulk(destinationPincodes: string[], carrierCode = "delhivery") {
  return postJson<{ results: ServiceabilityResult[] }>("/api/serviceability-check/bulk", {
    destinationPincodes,
    carrierCode,
  });
}

export type SlabKey =
  | "flat_0_250"
  | "flat_upto_500"
  | "flat_upto_5000"
  | "flat_upto_10000"
  | "additional_500g_500_to_5000"
  | "additional_1kg_5000_to_10000"
  | "additional_1kg_beyond_10000";

export interface RateCard {
  id: string;
  carrier_id: string;
  name: string;
  fuel_surcharge_percent: number;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
  slab_prices: { slab_key: SlabKey; zone_code: string; price_rupees: number }[];
}

export function fetchRateCards(carrierCode = "delhivery") {
  return getJson<{ rateCards: RateCard[] }>(`/api/rate-cards?carrierCode=${encodeURIComponent(carrierCode)}`);
}

export interface NewRateCardVersionInput {
  carrierCode: string;
  name: string;
  fuelSurchargePercent: number;
  effectiveFrom: string;
  slabPrices: { slabKey: SlabKey; zoneCode: string; priceRupees: number }[];
}

export function submitRateCardVersion(input: NewRateCardVersionInput) {
  return postJson<{ rateCard: RateCard }>("/api/rate-cards", input);
}

export interface ClientRateCard {
  id: string;
  client_id: string;
  name: string;
  fuel_surcharge_percent: number;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
  slab_prices: { slab_key: SlabKey; zone_code: string; price_rupees: number }[];
}

export function fetchClientRateCards(clientId: string) {
  return getJson<{ rateCards: ClientRateCard[] }>(`/api/client-rate-cards?clientId=${encodeURIComponent(clientId)}`);
}

export interface NewClientRateCardVersionInput {
  clientId: string;
  name: string;
  fuelSurchargePercent: number;
  effectiveFrom: string;
  slabPrices: { slabKey: SlabKey; zoneCode: string; priceRupees: number }[];
}

export function submitClientRateCardVersion(input: NewClientRateCardVersionInput) {
  return postJson<{ rateCard: ClientRateCard }>("/api/client-rate-cards", input);
}

export function updateCodCollectionStatus(shipmentId: string, status: "pending" | "collected" | "remitted") {
  return patchJson(`/api/shipments/${shipmentId}/cod-collection-status`, { status });
}

export function recordVendorWeight(shipmentId: string, vendorChargedWeightGrams: number) {
  return patchJson(`/api/shipments/${shipmentId}/vendor-weight`, { vendorChargedWeightGrams });
}

export function updateWeightDiscrepancyStatus(
  shipmentId: string,
  status: "accepted" | "disputed" | "resolved",
) {
  return patchJson(`/api/shipments/${shipmentId}/weight-discrepancy-status`, { status });
}

export interface PickupRequestResult {
  pickupRequest: { id: string; status: string; pickup_date: string };
}

export function schedulePickup(shipmentId: string, pickupDate: string) {
  return postJson<PickupRequestResult>(`/api/shipments/${shipmentId}/pickup`, { pickupDate });
}

export function initiateDto(shipmentId: string, pickupDate: string) {
  return postJson<{ shipment: { id: string; awb: string }; pickupRequest: { id: string } }>(
    `/api/shipments/${shipmentId}/reverse-pickup`,
    { pickupDate },
  );
}

export interface CreateReversePickupInput {
  orderId: string;
  clientId: string;
  clientName: string;
  carrierCode: string;
  pickupAddressLine: string;
  pickupCity: string;
  pickupPincode: string;
  destinationPincode: string;
  weightGrams: number;
  dimensions: Dimensions;
  shipmentValueRupees: number;
  pickupDate: string;
}

export function createReversePickup(input: CreateReversePickupInput) {
  return postJson<{ shipment: { id: string; awb: string }; pickupRequest: { id: string } }>(
    "/api/reverse-pickups",
    input,
  );
}

export function fetchShipmentLabel(shipmentId: string) {
  return getJson<{ labelUrl?: string }>(`/api/shipments/${shipmentId}/label`);
}

export function fetchNdrQueue() {
  return getJson<{ shipments: Shipment[] }>("/api/ndr-queue");
}

export function requestNdrReattempt(shipmentId: string) {
  return postJson<{ attemptNumber: number; maxAttempts: number }>(`/api/shipments/${shipmentId}/ndr/reattempt`, {});
}

export function editNdrAddress(shipmentId: string, addressLine: string, city: string) {
  return postJson(`/api/shipments/${shipmentId}/ndr/address`, { addressLine, city });
}

export function contactNdrCustomer(shipmentId: string, notes: string) {
  return postJson(`/api/shipments/${shipmentId}/ndr/contact`, { notes });
}

export function convertNdrToRto(shipmentId: string) {
  return postJson(`/api/shipments/${shipmentId}/ndr/convert-rto`, {});
}

export interface ExceptionLogEntry {
  id: string;
  source: "booking" | "tracking_poll";
  shipment_id: string | null;
  carrier_id: string | null;
  error_message: string;
  status: "open" | "acknowledged" | "resolved";
  created_at: string;
}

export function fetchExceptions(status = "open") {
  return getJson<{ exceptions: ExceptionLogEntry[] }>(`/api/exceptions?status=${status}`);
}

export function resolveException(id: string) {
  return postJson(`/api/exceptions/${id}/resolve`, {});
}

export interface ClientInvoice {
  id: string;
  client_id: string;
  invoice_number: string;
  period_from: string;
  period_to: string;
  subtotal_rupees: number;
  tax_rupees: number;
  total_rupees: number;
  status: string;
  created_at: string;
  clients?: { name: string } | null;
}

export function fetchInvoices(clientId?: string) {
  const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
  return getJson<{ invoices: ClientInvoice[] }>(`/api/invoices${query}`);
}

export function generateInvoice(clientId: string, periodFrom: string, periodTo: string) {
  return postJson<{ invoice: ClientInvoice }>("/api/invoices", { clientId, periodFrom, periodTo });
}

export interface VendorReconciliationResult {
  batchId: string;
  totalLines: number;
  matched: number;
  discrepancy: number;
}

export function reconcileVendorInvoice(
  carrierCode: string,
  rows: { awb: string; vendorBilledAmountRupees: number }[],
  fileName?: string,
) {
  return postJson<VendorReconciliationResult>("/api/vendor-invoices/reconcile", { carrierCode, rows, fileName });
}

export interface VendorInvoiceLine {
  id: string;
  awb: string;
  shipment_id: string | null;
  vendor_billed_amount_rupees: number;
  expected_amount_rupees: number | null;
  discrepancy_rupees: number | null;
  status: "matched" | "discrepancy" | "unmatched";
}

export function fetchVendorInvoiceLines(batchId: string) {
  return getJson<{ lines: VendorInvoiceLine[] }>(`/api/vendor-invoices/${batchId}/lines`);
}

export interface CarrierRemittanceResult {
  batchId: string;
  totalLines: number;
  matched: number;
}

export function reconcileCarrierRemittance(
  carrierCode: string,
  rows: { awb: string; remittedAmountRupees: number }[],
  fileName?: string,
) {
  return postJson<CarrierRemittanceResult>("/api/carrier-remittance/reconcile", { carrierCode, rows, fileName });
}

export interface CarrierRemittanceLine {
  id: string;
  awb: string;
  shipment_id: string | null;
  remitted_amount_rupees: number;
  status: "matched" | "unmatched";
}

export function fetchCarrierRemittanceLines(batchId: string) {
  return getJson<{ lines: CarrierRemittanceLine[] }>(`/api/carrier-remittance/${batchId}/lines`);
}

export interface ClientLedgerEntry {
  id: string;
  client_id: string;
  entry_type: "freight_debit" | "freight_credit" | "cod_credit" | "cod_debit";
  amount_rupees: number;
  description: string;
  created_at: string;
}

export function fetchClientLedgerEntries(clientId: string) {
  return getJson<{ entries: ClientLedgerEntry[] }>(`/api/client-ledger/${clientId}`);
}

export interface ClientLedgerSummary {
  clientId: string;
  clientName: string;
  settlementMode: SettlementMode;
  freightBalanceRupees: number;
  codBalanceRupees: number;
  netBalanceRupees: number;
}

export function fetchClientLedgerSummaries() {
  return getJson<{ summaries: ClientLedgerSummary[] }>("/api/client-ledger/summary");
}

export function recordClientPayment(clientId: string, amountRupees: number, paymentDate: string, reference?: string) {
  return postJson("/api/client-payments", { clientId, amountRupees, paymentDate, reference });
}

export interface ClientSettlementRun {
  id: string;
  client_id: string;
  period_from: string;
  period_to: string;
  freight_total_rupees: number;
  cod_total_rupees: number;
  net_amount_rupees: number;
  created_at: string;
}

export function settlePeriod(clientId: string, periodFrom: string, periodTo: string) {
  return postJson<{ settlementRun: ClientSettlementRun }>(`/api/clients/${clientId}/settle-period`, {
    periodFrom,
    periodTo,
  });
}

export function fetchSettlementRuns(clientId: string) {
  return getJson<{ settlementRuns: ClientSettlementRun[] }>(`/api/clients/${clientId}/settlement-runs`);
}

export function remitCodToClient(clientId: string, amountRupees: number, reference?: string) {
  return postJson(`/api/clients/${clientId}/remit-cod`, { amountRupees, reference });
}

export interface DtoRequest {
  id: string;
  client_id: string;
  clients?: { name: string } | null;
  external_reference: string | null;
  customer_name: string;
  customer_phone: string | null;
  pickup_address_line: string;
  pickup_city: string;
  pickup_pincode: string;
  destination_pincode: string;
  weight_grams: number;
  reason: string | null;
  carrier_code: string;
  status: "pending" | "approved" | "rejected" | "booked";
  created_at: string;
}

export function fetchDtoRequests() {
  return getJson<{ requests: DtoRequest[] }>("/api/dto-requests");
}

export function approveDtoRequest(id: string, pickupDate: string) {
  return postJson<{ dtoRequest: DtoRequest; shipment: { id: string; awb: string } }>(
    `/api/dto-requests/${id}/approve`,
    { pickupDate },
  );
}

export function rejectDtoRequest(id: string, reason: string) {
  return postJson<{ dtoRequest: DtoRequest }>(`/api/dto-requests/${id}/reject`, { reason });
}

export interface ClientApiKey {
  id: string;
  label: string;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export function fetchClientApiKeys(clientId: string) {
  return getJson<{ apiKeys: ClientApiKey[] }>(`/api/clients/${clientId}/api-keys`);
}

export function generateClientApiKey(clientId: string, label: string) {
  return postJson<{ apiKey: ClientApiKey; plaintext: string }>(`/api/clients/${clientId}/api-keys`, { label });
}

export function revokeClientApiKey(keyId: string) {
  return postJson(`/api/api-keys/${keyId}/revoke`, {});
}

export interface UnicommerceCredential {
  id: string;
  username: string;
  label: string;
  active: boolean;
  created_at: string;
}

export function fetchUnicommerceCredentials(clientId: string) {
  return getJson<{ credentials: UnicommerceCredential[] }>(`/api/clients/${clientId}/unicommerce-credentials`);
}

export function issueUnicommerceCredentials(clientId: string, label: string) {
  return postJson<{ credential: UnicommerceCredential; username: string; password: string }>(
    `/api/clients/${clientId}/unicommerce-credentials`,
    { label },
  );
}
