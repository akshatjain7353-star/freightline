import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "◧" },
  { to: "/shipments", label: "Shipments", icon: "▤" },
  { to: "/create-shipment", label: "Create Shipment", icon: "＋" },
  { to: "/rate-calculator", label: "Rate Calculator", icon: "₹" },
  { to: "/bulk-upload", label: "Bulk Upload", icon: "⇧" },
];

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-border">
        <span className="font-mono text-sm font-semibold tracking-wider text-primary">FREIGHTLINE</span>
      </div>
      <nav className="flex-1 py-2">
        {NAV_ITEMS.map((item) => (
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
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-border text-xs text-muted">Time Bound · Internal Ops</div>
    </aside>
  );
}
