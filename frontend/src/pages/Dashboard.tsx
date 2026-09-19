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
  const { data: kpis, isLoading: kpisLoading } = useDashboardKpis();
  const { data: trend, isLoading: trendLoading } = useDashboardTrend();
  const { data: carrierDist, isLoading: carrierLoading } = useCarrierDistribution();
  const canSeeRevenue = role !== "ops_only";
  const { data: capabilities } = useCapabilities();

  return (
    <AppLayout title="Dashboard">
      {capabilities && !capabilities.delhiveryConfigured && (
        <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded px-3 py-2 mb-4">
          Delhivery is not configured. Quotes use the rate-card fallback, new bookings save locally without an
          AWB, and the tracking poller is off. Set <span className="font-mono">DELHIVERY_API_KEY</span> to
          enable live carrier calls.
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {canSeeRevenue && !trendLoading && trend && <RevenueVolumeChart data={trend} />}
        {!carrierLoading && carrierDist && <CarrierDistributionChart data={carrierDist} />}
      </div>
    </AppLayout>
  );
}
