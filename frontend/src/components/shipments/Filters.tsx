import type { Carrier, Client } from "../../lib/types";
import type { ShipmentFilters } from "../../hooks/useShipments";

interface FiltersProps {
  filters: ShipmentFilters;
  onChange: (filters: ShipmentFilters) => void;
  carriers: Carrier[];
  clients: Client[];
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
  { value: "ndr", label: "NDR" },
  { value: "rto", label: "RTO" },
];

const inputClass =
  "bg-surface2 border border-border rounded px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-accent";

export function Filters({ filters, onChange, carriers, clients }: FiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <input
        type="text"
        placeholder="Search AWB, order ID, pincode..."
        value={filters.search ?? ""}
        onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
        className={`${inputClass} w-64`}
      />
      <select
        value={filters.status ?? ""}
        onChange={(e) => onChange({ ...filters, status: e.target.value || undefined })}
        className={inputClass}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select
        value={filters.carrierId ?? ""}
        onChange={(e) => onChange({ ...filters, carrierId: e.target.value || undefined })}
        className={inputClass}
      >
        <option value="">All carriers</option>
        {carriers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        value={filters.clientId ?? ""}
        onChange={(e) => onChange({ ...filters, clientId: e.target.value || undefined })}
        className={inputClass}
      >
        <option value="">All clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={filters.dateFrom?.slice(0, 10) ?? ""}
        onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
        className={inputClass}
      />
      <span className="text-muted text-xs">to</span>
      <input
        type="date"
        value={filters.dateTo?.slice(0, 10) ?? ""}
        onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
        className={inputClass}
      />
      {(filters.status || filters.carrierId || filters.clientId || filters.dateFrom || filters.dateTo || filters.search) && (
        <button onClick={() => onChange({})} className="text-xs text-secondary hover:text-primary underline">
          Clear filters
        </button>
      )}
    </div>
  );
}
