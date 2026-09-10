import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardTrendPoint } from "../../lib/types";

export function RevenueVolumeChart({ data }: { data: DashboardTrendPoint[] }) {
  const chartData = data.map((d) => ({
    day: new Date(d.day).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    revenue: d.revenue,
    shipments: d.shipment_count,
  }));

  return (
    <div className="bg-surface border border-border rounded p-4">
      <h3 className="text-sm font-medium text-secondary mb-3">Revenue &amp; Volume — Last 14 Days</h3>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border-color))" />
          <XAxis dataKey="day" stroke="rgb(var(--text-muted))" fontSize={11} />
          <YAxis yAxisId="revenue" stroke="rgb(var(--text-muted))" fontSize={11} />
          <YAxis yAxisId="shipments" orientation="right" stroke="rgb(var(--text-muted))" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--bg-surface2))",
              border: "1px solid rgb(var(--border-color))",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: "rgb(var(--text-primary))" }}
          />
          <Area
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            fill="rgb(var(--accent) / 0.15)"
            stroke="rgb(var(--accent))"
            name="Revenue (₹)"
          />
          <Line
            yAxisId="shipments"
            type="monotone"
            dataKey="shipments"
            stroke="rgb(var(--status-info))"
            strokeWidth={2}
            dot={false}
            name="Shipments"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
