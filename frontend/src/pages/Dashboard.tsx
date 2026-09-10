import { AppLayout } from "../components/layout/AppLayout";
import { StatCard } from "../components/dashboard/StatCard";
import { RevenueVolumeChart } from "../components/dashboard/RevenueVolumeChart";
import { CarrierDistributionChart } from "../components/dashboard/CarrierDistributionChart";
import { useCarrierDistribution, useDashboardKpis, useDashboardTrend } from "../hooks/useDashboardStats";

function formatRupees(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function Dashboard() {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKpis();
  const { data: trend, isLoading: trendLoading } = useDashboardTrend();
  const { data: carrierDist, isLoading: carrierLoading } = useCarrierDistribution();

  return (
    <AppLayout title="Dashboard">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard label="Total Shipments" value={kpisLoading ? "…" : String(kpis?.total_shipments ?? 0)} />
        <StatCard label="Revenue" value={kpisLoading ? "…" : formatRupees(kpis?.revenue ?? 0)} />
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
        {!trendLoading && trend && <RevenueVolumeChart data={trend} />}
        {!carrierLoading && carrierDist && <CarrierDistributionChart data={carrierDist} />}
      </div>
    </AppLayout>
  );
}
