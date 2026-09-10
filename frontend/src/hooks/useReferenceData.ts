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
