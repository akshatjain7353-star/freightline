import { delhiveryHttp } from "./client.js";
import type { LabelResult } from "../../lib/types.js";

/**
 * GET /api/p/packing_slip?wbns=<awb> (Delhivery Generate Shipping Label API).
 *
 * Endpoint path, params, and response shape are unconfirmed against real
 * Delhivery docs/sandbox — verify before relying on this for real labels.
 */
export async function generateLabel(awb: string): Promise<LabelResult> {
  const response = await delhiveryHttp.get("/api/p/packing_slip", {
    params: { wbns: awb, pdf: true },
  });

  const labelUrl = response.data?.packages_found?.[0]?.pdf_download_link;
  return { labelUrl, raw: response.data };
}
