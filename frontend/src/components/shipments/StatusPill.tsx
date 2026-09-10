import type { ShipmentStatus } from "../../lib/types";

const STATUS_STYLES: Record<ShipmentStatus, string> = {
  pending: "bg-muted/20 text-secondary border-muted/40",
  in_transit: "bg-info/15 text-info border-info/40",
  delivered: "bg-success/15 text-success border-success/40",
  ndr: "bg-warning/15 text-warning border-warning/40",
  rto: "bg-danger/15 text-danger border-danger/40",
};

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending: "Pending",
  in_transit: "In Transit",
  delivered: "Delivered",
  ndr: "NDR",
  rto: "RTO",
};

export function StatusPill({ status }: { status: ShipmentStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
