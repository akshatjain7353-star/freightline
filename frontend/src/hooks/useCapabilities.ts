import { useQuery } from "@tanstack/react-query";
import { fetchCapabilities } from "../api/backend";

export function useCapabilities() {
  return useQuery({
    queryKey: ["capabilities"],
    queryFn: fetchCapabilities,
    staleTime: 60_000,
    retry: 1,
  });
}
