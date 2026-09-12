import { NavLink } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import { useOpenExceptionCount } from "../../hooks/useReferenceData";
import type { AppRole } from "../../lib/types";

const NAV_ITEMS: { to: string; label: string; icon: string; allowedRoles?: AppRole[]; badge?: "exceptions" }[] = [
  { to: "/", label: "Dashboard", icon: "◧" },
  { to: "/shipments", label: "Shipments", icon: "▤" },
  { to: "/create-shipment", label: "Create Shipment", icon: "＋" },
  { to: "/rate-calculator", label: "Rate Calculator", icon: "₹", allowedRoles: ["admin", "accounts_ops"] },
  { to: "/bulk-upload", label: "Bulk Upload", icon: "⇧" },
  { to: "/create-reverse-pickup", label: "Create Reverse Pickup", icon: "↩" },
  { to: "/dto-requests", label: "DTO Requests", icon: "⇄" },
  { to: "/weight-discrepancies", label: "Weight Discrepancies", icon: "⚖" },
  { to: "/cash-reconciliation", label: "Cash Reconciliation", icon: "⇋" },
  { to: "/ndr-queue", label: "NDR Queue", icon: "⚠" },
  { to: "/exceptions", label: "Exceptions", icon: "✕", badge: "exceptions" },
  { to: "/admin/rate-cards", label: "Rate Cards", icon: "§", allowedRoles: ["admin", "accounts_ops"] },
  {
    to: "/admin/client-rate-cards",
    label: "Client Rate Cards",
    icon: "◈",
    allowedRoles: ["admin", "accounts_ops"],
  },
  { to: "/admin/invoices", label: "Invoices", icon: "🧾", allowedRoles: ["admin", "accounts_ops"] },
  {
    to: "/admin/vendor-reconciliation",
    label: "Vendor Reconciliation",
    icon: "⇄",
    allowedRoles: ["admin", "accounts_ops"],
  },
  {
    to: "/admin/carrier-remittance",
    label: "Carrier COD Remittance",
    icon: "⇆",
    allowedRoles: ["admin", "accounts_ops"],
  },
  { to: "/admin/client-ledger", label: "Client Ledger", icon: "𝓛", allowedRoles: ["admin", "accounts_ops"] },
  { to: "/admin/client-api-keys", label: "API Keys", icon: "🔑", allowedRoles: ["admin"] },
  { to: "/admin/unicommerce-credentials", label: "Unicommerce Credentials", icon: "🔗", allowedRoles: ["admin"] },
];

export function Sidebar() {
  const { role } = useAuth();
  const { data: openExceptionCount } = useOpenExceptionCount();
  const items = NAV_ITEMS.filter((item) => !item.allowedRoles || (role && item.allowedRoles.includes(role)));

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-border">
        <span className="font-mono text-sm font-semibold tracking-wider text-primary">FREIGHTLINE</span>
      </div>
      <nav className="flex-1 py-2">
        {items.map((item) => (
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
            <span className="flex-1">{item.label}</span>
            {item.badge === "exceptions" && !!openExceptionCount && (
              <span className="text-xs bg-danger/15 text-danger border border-danger/40 rounded-full px-1.5 leading-5">
                {openExceptionCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-border text-xs text-muted">Time Bound · Internal Ops</div>
    </aside>
  );
}
