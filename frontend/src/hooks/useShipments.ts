import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Shipment } from "../lib/types";

export interface ShipmentFilters {
  status?: string;
  carrierId?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export const SHIPMENTS_PAGE_SIZE = 50;

export interface PagedShipments {
  rows: Shipment[];
  totalCount: number;
}

/**
 * page is 0-indexed. Uses Supabase's range() + exact count instead of a flat
 * .limit() so results beyond one page are never silently hidden - the
 * caller always knows the true total via totalCount.
 */
export function useShipments(filters: ShipmentFilters, page = 0, pageSize = SHIPMENTS_PAGE_SIZE) {
  return useQuery({
    queryKey: ["shipments", filters, page, pageSize],
    queryFn: async (): Promise<PagedShipments> => {
      let query = supabase
        .from("shipments_ops_view")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (filters.status) query = query.eq("status", filters.status);
      if (filters.carrierId) query = query.eq("carrier_id", filters.carrierId);
      if (filters.clientId) query = query.eq("client_id", filters.clientId);
      if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
      if (filters.dateTo) query = query.lte("created_at", filters.dateTo);
      if (filters.search) {
        query = query.or(
          `awb.ilike.%${filters.search}%,order_id.ilike.%${filters.search}%,origin_pincode.ilike.%${filters.search}%,destination_pincode.ilike.%${filters.search}%`,
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as Shipment[], totalCount: count ?? 0 };
    },
  });
}

export function useShipment(id: string | undefined) {
  return useQuery({
    queryKey: ["shipment", id],
    enabled: !!id,
    queryFn: async (): Promise<Shipment> => {
      const { data, error } = await supabase.from("shipments_ops_view").select("*").eq("id", id).single();
      if (error) throw error;
      return data as unknown as Shipment;
    },
  });
}

export function useRelatedShipments(id: string | undefined) {
  return useQuery({
    queryKey: ["related-shipments", id],
    enabled: !!id,
    queryFn: async (): Promise<Shipment[]> => {
      const { data, error } = await supabase.from("shipments_ops_view").select("*").eq("related_shipment_id", id);
      if (error) throw error;
      return (data ?? []) as unknown as Shipment[];
    },
  });
}

export function useWeightDiscrepancies() {
  return useQuery({
    queryKey: ["weight-discrepancies"],
    queryFn: async (): Promise<Shipment[]> => {
      const { data, error } = await supabase
        .from("shipments_ops_view")
        .select("*")
        .eq("weight_discrepancy_flagged", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Shipment[];
    },
  });
}
