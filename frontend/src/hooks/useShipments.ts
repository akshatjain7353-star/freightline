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
        .from("shipments")
        .select("*, clients(id, name), carriers(id, name)")
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
