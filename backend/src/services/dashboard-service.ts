import { supabase } from "../supabase/client.js";
import { GST_RATE_PERCENT } from "./invoice-service.js";
import type { AppRole } from "../lib/types.js";

const TOP_CLIENT_COUNT = 5;
const OTHER_BUCKET_LABEL = "Other";

export interface DashboardKpis {
  total_shipments: number;
  revenue: number | null;
  revenue_incl_gst: number | null;
  delivered_pct: number;
  ndr_pct: number;
  rto_pct: number;
  cod_share_pct: number;
  in_transit_count: number;
  not_picked_up_count: number;
}

/**
 * Queried here (service-role) rather than directly from the frontend, so
 * the GST-inclusive figure can share GST_RATE_PERCENT with invoicing
 * instead of a second hardcoded rate drifting out of sync. Money fields are
 * masked for ops_only in JS here instead of the view's old current_app_role()
 * check, since that function resolves against the *calling* session's
 * auth.uid() - meaningless once only the service-role client queries this.
 */
export async function getDashboardKpis(role: AppRole | null): Promise<DashboardKpis> {
  const { data, error } = await supabase.from("dashboard_kpis").select("*").single();
  if (error || !data) throw error ?? new Error("dashboard_kpis returned no row");

  const revenue = Number(data.revenue);
  const isMasked = role === "ops_only";

  return {
    total_shipments: data.total_shipments,
    revenue: isMasked ? null : revenue,
    revenue_incl_gst: isMasked ? null : Math.round(revenue * (1 + GST_RATE_PERCENT / 100) * 100) / 100,
    delivered_pct: data.delivered_pct,
    ndr_pct: data.ndr_pct,
    rto_pct: data.rto_pct,
    cod_share_pct: data.cod_share_pct,
    in_transit_count: data.in_transit_count,
    not_picked_up_count: data.not_picked_up_count,
  };
}

export interface DashboardTrendPoint {
  day: string;
  [clientBucketOrOther: string]: string | number;
}

export interface DashboardTrendResult {
  points: DashboardTrendPoint[];
  clientKeys: string[];
}

/**
 * One line per client instead of one aggregate line - the top 5 clients by
 * revenue in the 14-day window get their own line, everyone else folds into
 * "Other". Computed here (not a SQL view) since the ranking step is more
 * naturally expressed in JS than a window-function view, and this is a
 * display-only reshaping - it doesn't change any underlying data or export.
 */
export async function getDashboardTrend(role: AppRole | null): Promise<DashboardTrendResult> {
  if (role === "ops_only") return { points: [], clientKeys: [] };

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
  const fromDate = fourteenDaysAgo.toISOString().slice(0, 10);

  const { data: shipments, error } = await supabase
    .from("shipments")
    .select("created_at, client_billed_amount, clients(name)")
    .gte("created_at", fromDate);
  if (error) throw error;

  const rows = (shipments ?? []).map((s) => ({
    day: (s.created_at as string).slice(0, 10),
    clientName: (s.clients as unknown as { name: string } | null)?.name ?? "Unknown",
    revenue: Number(s.client_billed_amount) || 0,
  }));

  const revenueByClient = new Map<string, number>();
  for (const row of rows) {
    revenueByClient.set(row.clientName, (revenueByClient.get(row.clientName) ?? 0) + row.revenue);
  }
  const topClients = [...revenueByClient.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_CLIENT_COUNT)
    .map(([name]) => name);
  const topClientSet = new Set(topClients);

  const bucketOf = (clientName: string) => (topClientSet.has(clientName) ? clientName : OTHER_BUCKET_LABEL);
  const clientKeys = [...topClients, ...(rows.some((r) => !topClientSet.has(r.clientName)) ? [OTHER_BUCKET_LABEL] : [])];

  const days: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(fourteenDaysAgo);
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }

  const points: DashboardTrendPoint[] = days.map((day) => {
    const point: DashboardTrendPoint = { day };
    for (const key of clientKeys) point[key] = 0;
    return point;
  });
  const pointByDay = new Map(points.map((p) => [p.day, p]));

  for (const row of rows) {
    const point = pointByDay.get(row.day);
    if (!point) continue;
    const bucket = bucketOf(row.clientName);
    point[bucket] = (point[bucket] as number) + row.revenue;
  }

  return { points, clientKeys };
}
