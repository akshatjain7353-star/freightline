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
  const { data, isLoading, isError } = useShipments(filters, page);
  const { data: carriers } = useCarriers();
  const { data: clients } = useClients();

  function handleFiltersChange(next: ShipmentFilters) {
    setFilters(next);
    setPage(0); // filters change what "page 1" means - always reset
  }

  return (
    <AppLayout title="Shipments">
      {isError && (
        <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2 mb-4">
          Could not load shipments. Confirm you are signed in and that migrations through 0023 plus{" "}
          <span className="font-mono">seed.sql</span> have been applied.
        </div>
      )}
      <Filters filters={filters} onChange={handleFiltersChange} carriers={carriers ?? []} clients={clients ?? []} />
      <ShipmentsTable
        shipments={data?.rows ?? []}
        isLoading={isLoading}
        emptyHint={
          Object.values(filters).some(Boolean)
            ? "No shipments match these filters."
            : "No shipments yet. Create one, upload a CSV, or run supabase/seed.sql for sample Phase 1 rows."
        }
      />
      {!isLoading && (
        <Pagination page={page} pageSize={SHIPMENTS_PAGE_SIZE} totalCount={data?.totalCount ?? 0} onPageChange={setPage} />
      )}
    </AppLayout>
  );
}
