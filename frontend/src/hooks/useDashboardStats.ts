import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { fetchDashboardKpis, fetchDashboardTrend } from "../api/backend";
import type { CarrierDistributionPoint, DashboardKpis, DashboardTrend } from "../lib/types";

// KPIs and the per-client trend go through the Express backend now, not a
// direct Supabase view query - the GST-inclusive revenue figure needs to
// share GST_RATE_PERCENT with invoice generation (see dashboard-service.ts),
// which a raw SQL view can't do, and money-field role masking moved there
// with it. Carrier distribution has no money figures, so it stays a direct
// view query.
export function useDashboardKpis() {
  return useQuery<DashboardKpis>({
    queryKey: ["dashboard-kpis"],
    queryFn: fetchDashboardKpis,
  });
}

export function useDashboardTrend() {
  return useQuery<DashboardTrend>({
    queryKey: ["dashboard-trend"],
    queryFn: fetchDashboardTrend,
  });
}

export function useCarrierDistribution() {
  return useQuery({
    queryKey: ["dashboard-carrier-distribution"],
    queryFn: async (): Promise<CarrierDistributionPoint[]> => {
      const { data, error } = await supabase.from("dashboard_carrier_distribution").select("*");
      if (error) throw error;
      return (data ?? []) as CarrierDistributionPoint[];
    },
  });
}
