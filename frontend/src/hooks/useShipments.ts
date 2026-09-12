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

export function useShipments(filters: ShipmentFilters) {
  return useQuery({
    queryKey: ["shipments", filters],
    queryFn: async (): Promise<Shipment[]> => {
      let query = supabase
        .from("shipments_ops_view")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

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

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Shipment[];
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
