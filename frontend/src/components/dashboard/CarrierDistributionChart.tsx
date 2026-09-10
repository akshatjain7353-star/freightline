import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CarrierDistributionPoint } from "../../lib/types";

export function CarrierDistributionChart({ data }: { data: CarrierDistributionPoint[] }) {
  return (
    <div className="bg-surface border border-border rounded p-4">
      <h3 className="text-sm font-medium text-secondary mb-3">Carrier Distribution</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border-color))" />
          <XAxis dataKey="carrier_name" stroke="rgb(var(--text-muted))" fontSize={11} />
          <YAxis stroke="rgb(var(--text-muted))" fontSize={11} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--bg-surface2))",
              border: "1px solid rgb(var(--border-color))",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: "rgb(var(--text-primary))" }}
          />
          <Bar dataKey="shipment_count" fill="rgb(var(--accent))" radius={[3, 3, 0, 0]} name="Shipments" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
