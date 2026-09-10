const ACCENT_CLASSES = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
} as const;

export function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: keyof typeof ACCENT_CLASSES;
}) {
  const accentClass = accent ? ACCENT_CLASSES[accent] : "text-primary";
  return (
    <div className="bg-surface border border-border rounded p-4 flex flex-col gap-1 min-w-0">
      <span className="text-xs text-muted uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-semibold tabular-num ${accentClass}`}>{value}</span>
    </div>
  );
}
