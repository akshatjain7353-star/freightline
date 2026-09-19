import { NavLink } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import { useOpenExceptionCount } from "../../hooks/useReferenceData";
import type { AppRole } from "../../lib/types";
import { FEATURES, featureBadgeLabel, isFeatureVisibleToRole, type FeatureId } from "../../lib/feature-flags";

const NAV_ITEMS: {
  to: string;
  label: string;
  icon: string;
  allowedRoles?: AppRole[];
  badge?: "exceptions";
  feature: FeatureId;
}[] = [
  { to: "/", label: "Dashboard", icon: "◧", feature: "dashboard" },
  { to: "/shipments", label: "Shipments", icon: "▤", feature: "shipments" },
  { to: "/create-shipment", label: "Create Shipment", icon: "＋", feature: "createShipment" },
  { to: "/rate-calculator", label: "Rate Calculator", icon: "₹", allowedRoles: ["admin", "accounts_ops"], feature: "rateCalculator" },
  { to: "/bulk-upload", label: "Bulk Upload", icon: "⇧", feature: "bulkUpload" },
  { to: "/create-reverse-pickup", label: "Create Reverse Pickup", icon: "↩", feature: "reversePickup" },
  { to: "/dto-requests", label: "DTO Requests", icon: "⇄", feature: "dtoRequests" },
  { to: "/weight-discrepancies", label: "Weight Discrepancies", icon: "⚖", feature: "weightDiscrepancies" },
  {
    to: "/cash-reconciliation",
    label: "Cash Reconciliation",
    icon: "⇋",
    allowedRoles: ["admin", "accounts_ops"],
    feature: "cashReconciliation",
  },
  { to: "/ndr-queue", label: "NDR Queue", icon: "⚠", feature: "ndrQueue" },
  { to: "/exceptions", label: "Exceptions", icon: "✕", badge: "exceptions", feature: "exceptions" },
  { to: "/admin/rate-cards", label: "Rate Cards", icon: "§", allowedRoles: ["admin", "accounts_ops"], feature: "rateCards" },
  {
    to: "/admin/client-rate-cards",
    label: "Client Rate Cards",
    icon: "◈",
    allowedRoles: ["admin", "accounts_ops"],
    feature: "clientRateCards",
  },
  { to: "/admin/invoices", label: "Invoices", icon: "🧾", allowedRoles: ["admin", "accounts_ops"], feature: "invoices" },
  {
    to: "/admin/vendor-reconciliation",
    label: "Vendor Reconciliation",
    icon: "⇄",
    allowedRoles: ["admin", "accounts_ops"],
    feature: "vendorReconciliation",
  },
  {
    to: "/admin/carrier-remittance",
    label: "Carrier COD Remittance",
    icon: "⇆",
    allowedRoles: ["admin", "accounts_ops"],
    feature: "carrierRemittance",
  },
  { to: "/admin/client-ledger", label: "Client Ledger", icon: "𝓛", allowedRoles: ["admin", "accounts_ops"], feature: "clientLedger" },
  { to: "/admin/client-api-keys", label: "API Keys", icon: "🔑", allowedRoles: ["admin"], feature: "clientApiKeys" },
  { to: "/admin/unicommerce-credentials", label: "Unicommerce Credentials", icon: "🔗", allowedRoles: ["admin"], feature: "unicommerce" },
];

export function Sidebar() {
  const { role } = useAuth();
  const { data: openExceptionCount } = useOpenExceptionCount();
  const items = NAV_ITEMS.filter((item) => {
    if (item.allowedRoles && (!role || !item.allowedRoles.includes(role))) return false;
    return isFeatureVisibleToRole(item.feature, role);
  });

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-border">
        <span className="font-mono text-sm font-semibold tracking-wider text-primary">FREIGHTLINE</span>
      </div>
      <nav className="flex-1 py-2 overflow-auto">
        {items.map((item) => {
          const readiness = FEATURES[item.feature].readiness;
          const badge = featureBadgeLabel(readiness);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 text-sm border-l-2 transition-colors ${
                  isActive
                    ? "border-accent bg-surface2 text-primary"
                    : "border-transparent text-secondary hover:bg-surface2 hover:text-primary"
                }`
              }
            >
              <span className="w-4 text-center">{item.icon}</span>
              <span className="flex-1 leading-snug">{item.label}</span>
              {item.badge === "exceptions" && !!openExceptionCount && (
                <span className="text-xs bg-danger/15 text-danger border border-danger/40 rounded-full px-1.5 leading-5">
                  {openExceptionCount}
                </span>
              )}
              {badge && (
                <span className="text-[10px] uppercase tracking-wide text-warning border border-warning/40 rounded px-1 leading-4">
                  {badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-border text-xs text-muted">Time Bound · Phase 1</div>
    </aside>
  );
}
