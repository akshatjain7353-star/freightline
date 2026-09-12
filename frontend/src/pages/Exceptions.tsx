import { useEffect, useState } from "react";
import { AppLayout } from "../components/layout/AppLayout";
import { fetchExceptions, resolveException, type ExceptionLogEntry } from "../api/backend";

const SOURCE_LABELS: Record<ExceptionLogEntry["source"], string> = {
  booking: "Booking",
  tracking_poll: "Tracking poll",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function Exceptions() {
  const [exceptions, setExceptions] = useState<ExceptionLogEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetchExceptions("open")
      .then((res) => setExceptions(res.exceptions))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleResolve(id: string) {
    setResolvingId(id);
    try {
      await resolveException(id);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <AppLayout title="Exceptions">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-secondary max-w-2xl">
          System-level failures — a failed vendor booking call, or a tracking-poll cycle that couldn't fetch
          status — distinct from the NDR queue, which is a delivery problem at the vendor rather than the system
          failing to do something.
        </p>

        {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}

        {loading ? (
          <div className="text-sm text-muted py-8 text-center">Loading…</div>
        ) : !exceptions || exceptions.length === 0 ? (
          <div className="text-sm text-muted py-8 text-center border border-dashed border-border rounded">
            No open exceptions.
          </div>
        ) : (
          <div className="overflow-auto border border-border rounded">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-surface2 text-xs text-secondary uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-3 py-2 border-b border-border">Source</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-border">Error</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-border">Occurred</th>
                  <th className="text-left font-medium px-3 py-2 border-b border-border">Action</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((e) => (
                  <tr key={e.id} className="border-b border-border">
                    <td className="px-3 py-2 whitespace-nowrap">{SOURCE_LABELS[e.source]}</td>
                    <td className="px-3 py-2 text-xs text-danger">{e.error_message}</td>
                    <td className="px-3 py-2 text-xs text-secondary whitespace-nowrap">{formatDate(e.created_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        disabled={resolvingId === e.id}
                        onClick={() => handleResolve(e.id)}
                        className="text-xs px-2 py-1 rounded border border-border text-secondary hover:text-primary hover:border-accent disabled:opacity-50"
                      >
                        Resolve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
