import { useState } from "react";
import { AppLayout } from "../components/layout/AppLayout";
import { Filters } from "../components/shipments/Filters";
import { ShipmentsTable } from "../components/shipments/ShipmentsTable";
import { Pagination } from "../components/common/Pagination";
import { useShipments, SHIPMENTS_PAGE_SIZE, type ShipmentFilters } from "../hooks/useShipments";
import { useCarriers, useClients } from "../hooks/useReferenceData";

export function Shipments() {
  const [filters, setFilters] = useState<ShipmentFilters>({});
  const [page, setPage] = useState(0);
  const { data, isLoading } = useShipments(filters, page);
  const { data: carriers } = useCarriers();
  const { data: clients } = useClients();

  function handleFiltersChange(next: ShipmentFilters) {
    setFilters(next);
    setPage(0); // filters change what "page 1" means - always reset
  }

  return (
    <AppLayout title="Shipments">
      <Filters filters={filters} onChange={handleFiltersChange} carriers={carriers ?? []} clients={clients ?? []} />
      <ShipmentsTable shipments={data?.rows ?? []} isLoading={isLoading} />
      {!isLoading && (
        <Pagination page={page} pageSize={SHIPMENTS_PAGE_SIZE} totalCount={data?.totalCount ?? 0} onPageChange={setPage} />
      )}
    </AppLayout>
  );
}
