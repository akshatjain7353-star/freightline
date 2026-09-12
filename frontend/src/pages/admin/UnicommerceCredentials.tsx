import { useEffect, useState } from "react";
import { AppLayout } from "../../components/layout/AppLayout";
import { useClients } from "../../hooks/useReferenceData";
import {
  fetchUnicommerceCredentials,
  issueUnicommerceCredentials,
  type UnicommerceCredential,
} from "../../api/backend";

const inputClass =
  "bg-surface2 border border-border rounded px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-accent w-full";
const labelClass = "text-xs text-secondary mb-1 block";

export function UnicommerceCredentials() {
  const { data: clients } = useClients();
  const [clientId, setClientId] = useState("");
  const [credentials, setCredentials] = useState<UnicommerceCredential[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null);

  function loadCredentials(id: string) {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchUnicommerceCredentials(id)
      .then((res) => setCredentials(res.credentials))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setIssued(null);
    if (clientId) loadCredentials(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function handleIssue() {
    if (!clientId || !label.trim()) return;
    setIssuing(true);
    setError(null);
    try {
      const result = await issueUnicommerceCredentials(clientId, label.trim());
      setIssued({ username: result.username, password: result.password });
      setLabel("");
      loadCredentials(clientId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIssuing(false);
    }
  }

  return (
    <AppLayout title="Unicommerce Credentials">
      <div className="flex flex-col gap-6 max-w-3xl">
        <div className="bg-surface border border-border rounded p-4">
          <label className={labelClass}>Client</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={`${inputClass} max-w-xs`}>
            <option value="" disabled>
              Select client
            </option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted mt-2">
            The username/password below is what this client enters into their own Unicommerce panel to add{" "}
            <strong>Time Bound</strong> as a courier option. Once configured, Unicommerce calls Time Bound directly
            whenever they ship an order via Time Bound — no separate connection step needed on our side.
          </p>
        </div>

        {clientId && (
          <>
            {issued && (
              <div className="bg-warning/10 border border-warning/40 rounded p-4 flex flex-col gap-2">
                <div className="text-sm font-medium text-warning">
                  Copy these now — the password won't be shown again.
                </div>
                <div className="text-xs">
                  <span className="text-muted">Username: </span>
                  <code className="bg-surface2 rounded px-1.5 py-0.5 font-mono">{issued.username}</code>
                </div>
                <div className="text-xs">
                  <span className="text-muted">Password: </span>
                  <code className="bg-surface2 rounded px-1.5 py-0.5 font-mono">{issued.password}</code>
                </div>
                <button
                  onClick={() => setIssued(null)}
                  className="text-xs text-secondary hover:text-primary underline self-start"
                >
                  I've copied them, dismiss
                </button>
              </div>
            )}

            <div className="bg-surface border border-border rounded p-4 flex items-end gap-3">
              <div className="flex-1">
                <label className={labelClass}>Label</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Production Unicommerce account"
                  className={inputClass}
                />
              </div>
              <button
                onClick={handleIssue}
                disabled={issuing || !label.trim()}
                className="bg-accent text-accent-fg rounded py-1.5 px-4 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {issuing ? "Issuing..." : "Issue credentials"}
              </button>
            </div>

            {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}

            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-border text-sm font-medium text-secondary">Issued credentials</div>
              {loading ? (
                <div className="p-4 text-sm text-muted">Loading…</div>
              ) : !credentials || credentials.length === 0 ? (
                <div className="p-4 text-sm text-muted">No Unicommerce credentials issued for this client yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-surface2 text-xs text-secondary uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Label</th>
                      <th className="text-left px-3 py-2">Username</th>
                      <th className="text-left px-3 py-2">Created</th>
                      <th className="text-left px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credentials.map((c) => (
                      <tr key={c.id} className="border-t border-border">
                        <td className="px-3 py-2">{c.label}</td>
                        <td className="px-3 py-2 font-mono text-xs">{c.username}</td>
                        <td className="px-3 py-2 text-xs text-secondary">
                          {new Date(c.created_at).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-3 py-2">
                          {c.active ? (
                            <span className="text-xs text-success">Active</span>
                          ) : (
                            <span className="text-xs text-muted">Inactive</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
