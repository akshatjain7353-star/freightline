import { useEffect, useState } from "react";
import { AppLayout } from "../../components/layout/AppLayout";
import { useClients } from "../../hooks/useReferenceData";
import { fetchClientApiKeys, generateClientApiKey, revokeClientApiKey, type ClientApiKey } from "../../api/backend";

const inputClass =
  "bg-surface2 border border-border rounded px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-accent w-full";
const labelClass = "text-xs text-secondary mb-1 block";

export function ClientApiKeys() {
  const { data: clients } = useClients();
  const [clientId, setClientId] = useState("");
  const [keys, setKeys] = useState<ClientApiKey[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [newPlaintext, setNewPlaintext] = useState<string | null>(null);

  function loadKeys(id: string) {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchClientApiKeys(id)
      .then((res) => setKeys(res.apiKeys))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setNewPlaintext(null);
    if (clientId) loadKeys(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function handleGenerate() {
    if (!clientId || !label.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateClientApiKey(clientId, label.trim());
      setNewPlaintext(result.plaintext);
      setLabel("");
      loadKeys(clientId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    setError(null);
    try {
      await revokeClientApiKey(keyId);
      loadKeys(clientId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <AppLayout title="API Keys">
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
            Issues a key this client's own systems use to call{" "}
            <code>POST /external/v1/dto-requests</code> — submitting a reverse-pickup/RTV request that lands in the{" "}
            <strong>DTO Requests</strong> queue for approval before any real carrier booking happens.
          </p>
        </div>

        {clientId && (
          <>
            {newPlaintext && (
              <div className="bg-warning/10 border border-warning/40 rounded p-4 flex flex-col gap-2">
                <div className="text-sm font-medium text-warning">
                  Copy this key now — it won't be shown again.
                </div>
                <code className="block text-xs bg-surface2 rounded p-2 font-mono break-all">{newPlaintext}</code>
                <button
                  onClick={() => setNewPlaintext(null)}
                  className="text-xs text-secondary hover:text-primary underline self-start"
                >
                  I've copied it, dismiss
                </button>
              </div>
            )}

            <div className="bg-surface border border-border rounded p-4 flex items-end gap-3">
              <div className="flex-1">
                <label className={labelClass}>New key label</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Production integration"
                  className={inputClass}
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating || !label.trim()}
                className="bg-accent text-accent-fg rounded py-1.5 px-4 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate new key"}
              </button>
            </div>

            {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}

            <div className="bg-surface border border-border rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-border text-sm font-medium text-secondary">Issued keys</div>
              {loading ? (
                <div className="p-4 text-sm text-muted">Loading…</div>
              ) : !keys || keys.length === 0 ? (
                <div className="p-4 text-sm text-muted">No API keys issued for this client yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-surface2 text-xs text-secondary uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Label</th>
                      <th className="text-left px-3 py-2">Created</th>
                      <th className="text-left px-3 py-2">Last used</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-left px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((k) => (
                      <tr key={k.id} className="border-t border-border">
                        <td className="px-3 py-2">{k.label}</td>
                        <td className="px-3 py-2 text-xs text-secondary">
                          {new Date(k.created_at).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-3 py-2 text-xs text-secondary">
                          {k.last_used_at ? new Date(k.last_used_at).toLocaleString("en-IN") : "Never"}
                        </td>
                        <td className="px-3 py-2">
                          {k.active ? (
                            <span className="text-xs text-success">Active</span>
                          ) : (
                            <span className="text-xs text-muted">Revoked</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {k.active && (
                            <button
                              onClick={() => handleRevoke(k.id)}
                              className="text-xs text-danger hover:underline"
                            >
                              Revoke
                            </button>
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
