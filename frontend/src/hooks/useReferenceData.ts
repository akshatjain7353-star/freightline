import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Carrier, Client } from "../lib/types";

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });
}

export function useCarriers() {
  return useQuery({
    queryKey: ["carriers"],
    queryFn: async (): Promise<Carrier[]> => {
      const { data, error } = await supabase.from("carriers").select("*").eq("active", true).order("name");
      if (error) throw error;
      return (data ?? []) as Carrier[];
    },
  });
}

export function useOpenExceptionCount() {
  return useQuery({
    queryKey: ["open-exception-count"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("exception_log")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export interface Zone {
  zone_code: string;
  zone_type: string;
}

export function useZones() {
  return useQuery({
    queryKey: ["zones"],
    queryFn: async (): Promise<Zone[]> => {
      const { data, error } = await supabase.from("zones").select("*").order("zone_code");
      if (error) throw error;
      return (data ?? []) as Zone[];
    },
  });
}
