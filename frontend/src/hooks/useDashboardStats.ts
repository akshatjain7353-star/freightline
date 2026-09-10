import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { CarrierDistributionPoint, DashboardKpis, DashboardTrendPoint } from "../lib/types";

export function useDashboardKpis() {
  return useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: async (): Promise<DashboardKpis> => {
      const { data, error } = await supabase.from("dashboard_kpis").select("*").single();
      if (error) throw error;
      return data as DashboardKpis;
    },
  });
}

export function useDashboardTrend() {
  return useQuery({
    queryKey: ["dashboard-trend"],
    queryFn: async (): Promise<DashboardTrendPoint[]> => {
      const { data, error } = await supabase.from("dashboard_trend_14d").select("*");
      if (error) throw error;
      return (data ?? []) as DashboardTrendPoint[];
    },
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
