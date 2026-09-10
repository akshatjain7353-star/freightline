import { useState } from "react";
import { AppLayout } from "../components/layout/AppLayout";
import { Filters } from "../components/shipments/Filters";
import { ShipmentsTable } from "../components/shipments/ShipmentsTable";
import { useShipments, type ShipmentFilters } from "../hooks/useShipments";
import { useCarriers, useClients } from "../hooks/useReferenceData";

export function Shipments() {
  const [filters, setFilters] = useState<ShipmentFilters>({});
  const { data: shipments, isLoading } = useShipments(filters);
  const { data: carriers } = useCarriers();
  const { data: clients } = useClients();

  return (
    <AppLayout title="Shipments">
      <Filters filters={filters} onChange={setFilters} carriers={carriers ?? []} clients={clients ?? []} />
      <ShipmentsTable shipments={shipments ?? []} isLoading={isLoading} />
    </AppLayout>
  );
}
