import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardTrend } from "../../lib/types";

// Cycled across whichever top-N client keys are present; "Other" always
// gets the last, muted color rather than competing for a bright one.
const LINE_COLORS = [
  "rgb(var(--accent))",
  "rgb(var(--status-success))",
  "rgb(var(--status-info))",
  "rgb(var(--status-warning))",
  "rgb(var(--status-danger))",
];
const OTHER_COLOR = "rgb(var(--text-muted))";

export function RevenueVolumeChart({ data }: { data: DashboardTrend }) {
  const chartData = data.points.map((point) => ({
    ...point,
    day: new Date(point.day).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
  }));

  return (
    <div className="bg-surface border border-border rounded p-4">
      <h3 className="text-sm font-medium text-secondary mb-3">Revenue by Client — Last 14 Days</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border-color))" />
          <XAxis dataKey="day" stroke="rgb(var(--text-muted))" fontSize={11} />
          <YAxis stroke="rgb(var(--text-muted))" fontSize={11} />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--bg-surface2))",
              border: "1px solid rgb(var(--border-color))",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: "rgb(var(--text-primary))" }}
          />
          {data.clientKeys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={key === "Other" ? OTHER_COLOR : LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={false}
              name={key}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
