import { AppLayout } from "../components/layout/AppLayout";
import { StatCard } from "../components/dashboard/StatCard";
import { RevenueVolumeChart } from "../components/dashboard/RevenueVolumeChart";
import { CarrierDistributionChart } from "../components/dashboard/CarrierDistributionChart";
import { useCarrierDistribution, useDashboardKpis, useDashboardTrend } from "../hooks/useDashboardStats";
import { useAuth } from "../lib/auth-context";
import { useCapabilities } from "../hooks/useCapabilities";

function formatRupees(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function Dashboard() {
  const { role } = useAuth();
  const { data: kpis, isLoading: kpisLoading, isError: kpisError } = useDashboardKpis();
  const { data: trend, isLoading: trendLoading } = useDashboardTrend();
  const { data: carrierDist, isLoading: carrierLoading } = useCarrierDistribution();
  const canSeeRevenue = role !== "ops_only";
  const { data: capabilities } = useCapabilities();

  return (
    <AppLayout title="Dashboard">
      {role === null && (
        <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded px-3 py-2 mb-4">
          This account has no role in <span className="font-mono">user_roles</span>. You can sign in, but pricing
          and admin screens stay blocked until an admin assigns <span className="font-mono">admin</span>,{" "}
          <span className="font-mono">accounts_ops</span>, or <span className="font-mono">ops_only</span>.
        </div>
      )}
      {capabilities && !capabilities.delhiveryConfigured && (
        <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded px-3 py-2 mb-4">
          Delhivery is not configured. Quotes use the rate-card fallback, new bookings save locally without an
          AWB, and the tracking poller is off. Set <span className="font-mono">DELHIVERY_API_KEY</span> to
          enable live carrier calls.
        </div>
      )}
      {kpisError && (
        <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2 mb-4">
          Could not load dashboard KPIs. Check that the backend is running and migrations through 0023 are applied.
        </div>
      )}
      {!kpisLoading && kpis && kpis.total_shipments === 0 && (
        <div className="text-xs text-muted bg-surface2 border border-border rounded px-3 py-2 mb-4">
          No shipments yet. Create one, upload a CSV, or run <span className="font-mono">supabase/seed.sql</span>{" "}
          (includes sample Phase 1 rows).
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Shipments" value={kpisLoading ? "…" : String(kpis?.total_shipments ?? 0)} />
        <StatCard label="Revenue (excl. GST)" value={kpisLoading ? "…" : formatRupees(kpis?.revenue)} />
        <StatCard label="Revenue (incl. GST)" value={kpisLoading ? "…" : formatRupees(kpis?.revenue_incl_gst)} />
        <StatCard label="In Transit" value={kpisLoading ? "…" : String(kpis?.in_transit_count ?? 0)} accent="info" />
        <StatCard
          label="Not Picked Up"
          value={kpisLoading ? "…" : String(kpis?.not_picked_up_count ?? 0)}
          accent="warning"
        />
        <StatCard
          label="Delivered %"
          value={kpisLoading ? "…" : `${kpis?.delivered_pct ?? 0}%`}
          accent="success"
        />
        <StatCard label="NDR %" value={kpisLoading ? "…" : `${kpis?.ndr_pct ?? 0}%`} accent="warning" />
        <StatCard label="RTO %" value={kpisLoading ? "…" : `${kpis?.rto_pct ?? 0}%`} accent="danger" />
        <StatCard label="COD Share" value={kpisLoading ? "…" : `${kpis?.cod_share_pct ?? 0}%`} accent="info" />
      </div>

      {!canSeeRevenue && (
        <p className="text-xs text-muted mb-4">Revenue figures are hidden for the operations-only role.</p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {canSeeRevenue && !trendLoading && trend && trend.clientKeys.length > 0 && <RevenueVolumeChart data={trend} />}
        {canSeeRevenue && !trendLoading && trend && trend.clientKeys.length === 0 && (
          <div className="bg-surface border border-dashed border-border rounded p-4 text-sm text-muted">
            No billed revenue in the last 14 days. Publish a client rate card, or use the Phase 1 seed shipments.
          </div>
        )}
        {!carrierLoading && carrierDist && carrierDist.length > 0 && <CarrierDistributionChart data={carrierDist} />}
        {!carrierLoading && (!carrierDist || carrierDist.length === 0) && (
          <div className="bg-surface border border-dashed border-border rounded p-4 text-sm text-muted">
            Carrier mix will appear after the first shipment is saved.
          </div>
        )}
      </div>
    </AppLayout>
  );
}
