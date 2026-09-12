import { supabase } from "../supabase/client.js";
import { calculateFallbackRate } from "../rate-engine/rate-card-calculator.js";
import { writeAuditLog } from "./audit-log-service.js";
import type { ZoneCode } from "../lib/types.js";

// Amounts within this tolerance count as "matched" rather than flagged as a
// discrepancy — avoids flagging rupee-level rounding noise.
const MATCH_TOLERANCE_RUPEES = 1;

export interface VendorInvoiceRow {
  awb: string;
  vendorBilledAmountRupees: number;
}

/**
 * Recomputes an "expected" amount for a shipment using vendor_charged_weight
 * (if recorded) against the specific rate card version active at booking
 * time (shipments.rate_card_id) — shipments.cost_rupees itself is left as
 * the immutable original quote, never recalculated post-booking, per the
 * confirmed design decision.
 */
async function computeExpectedAmount(shipment: {
  chargeable_weight_grams: number;
  vendor_charged_weight: number | null;
  rate_card_id: string | null;
  zone_code: string | null;
  payment_mode: "COD" | "Prepaid";
  shipment_value_rupees: number | null;
}): Promise<number | null> {
  if (!shipment.rate_card_id || !shipment.zone_code) return null;

  const { data: rateCard } = await supabase
    .from("rate_cards")
    .select("fuel_surcharge_percent")
    .eq("id", shipment.rate_card_id)
    .maybeSingle();
  if (!rateCard) return null;

  const weightForPricing = shipment.vendor_charged_weight ?? shipment.chargeable_weight_grams;

  try {
    const fallback = await calculateFallbackRate({
      rateCardId: shipment.rate_card_id,
      zoneCode: shipment.zone_code as ZoneCode,
      chargeableWeightGrams: weightForPricing,
      paymentMode: shipment.payment_mode,
      shipmentValueRupees: shipment.shipment_value_rupees ?? 0,
      fuelSurchargePercent: Number(rateCard.fuel_surcharge_percent),
    });
    return fallback.totalCostRupees;
  } catch {
    return null;
  }
}

export async function reconcileVendorInvoice(
  carrierCode: string,
  rows: VendorInvoiceRow[],
  fileName: string | undefined,
  actorId: string | null | undefined,
) {
  const { data: carrier, error: carrierError } = await supabase
    .from("carriers")
    .select("id")
    .eq("code", carrierCode)
    .single();
  if (carrierError || !carrier) throw new Error(`Carrier ${carrierCode} not found`);

  const { data: batch, error: batchError } = await supabase
    .from("vendor_invoice_batch")
    .insert({ carrier_id: carrier.id, file_name: fileName ?? null, uploaded_by: actorId ?? null, total_lines: rows.length })
    .select()
    .single();
  if (batchError || !batch) throw batchError ?? new Error("Failed to create reconciliation batch");

  let matchedCount = 0;
  let discrepancyCount = 0;
  const lines: Record<string, unknown>[] = [];

  for (const row of rows) {
    const { data: shipment } = await supabase
      .from("shipments")
      .select(
        "id, chargeable_weight_grams, vendor_charged_weight, rate_card_id, zone_code, payment_mode, shipment_value_rupees",
      )
      .eq("awb", row.awb)
      .maybeSingle();

    if (!shipment) {
      lines.push({
        batch_id: batch.id,
        awb: row.awb,
        shipment_id: null,
        vendor_billed_amount_rupees: row.vendorBilledAmountRupees,
        expected_amount_rupees: null,
        discrepancy_rupees: null,
        status: "unmatched",
      });
      continue;
    }

    const expectedAmount = await computeExpectedAmount(shipment);
    const discrepancy = expectedAmount !== null ? row.vendorBilledAmountRupees - expectedAmount : null;
    const status =
      expectedAmount === null
        ? "unmatched"
        : Math.abs(discrepancy!) > MATCH_TOLERANCE_RUPEES
          ? "discrepancy"
          : "matched";

    if (status === "matched") matchedCount++;
    if (status === "discrepancy") discrepancyCount++;

    lines.push({
      batch_id: batch.id,
      awb: row.awb,
      shipment_id: shipment.id,
      vendor_billed_amount_rupees: row.vendorBilledAmountRupees,
      expected_amount_rupees: expectedAmount,
      discrepancy_rupees: discrepancy,
      status,
    });
  }

  const { error: linesError } = await supabase.from("vendor_invoice_line").insert(lines);
  if (linesError) throw linesError;

  const { error: updateError } = await supabase
    .from("vendor_invoice_batch")
    .update({ matched_lines: matchedCount, discrepancy_lines: discrepancyCount })
    .eq("id", batch.id);
  if (updateError) throw updateError;

  await writeAuditLog({
    actorId,
    action: "vendor_invoice.reconciled",
    entityType: "vendor_invoice_batch",
    entityId: batch.id,
    after: { total: rows.length, matched: matchedCount, discrepancy: discrepancyCount },
  });

  return { batchId: batch.id, totalLines: rows.length, matched: matchedCount, discrepancy: discrepancyCount };
}

export async function listVendorInvoiceBatchLines(batchId: string) {
  const { data, error } = await supabase
    .from("vendor_invoice_line")
    .select("*")
    .eq("batch_id", batchId)
    .order("status", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
