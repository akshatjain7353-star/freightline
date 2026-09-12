import { useEffect, useState } from "react";
import { fetchImportMapping, saveImportMapping } from "../../api/backend";

export interface RequiredField {
  key: string;
  label: string;
}

interface CsvColumnMapperProps {
  importerKey: string;
  csvHeaders: string[];
  requiredFields: RequiredField[];
  onConfirm: (mapping: Record<string, string>) => void;
}

const selectClass =
  "bg-surface2 border border-border rounded px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-accent w-full";

/**
 * Lets ops map a CSV's actual column headers to the internal fields an
 * importer needs, instead of assuming a fixed column schema. The mapping is
 * saved per importerKey (global, not per-user - the file shape from a given
 * source is consistent regardless of who uploads it) so this doesn't need
 * to be redone on every upload once it's been set once for that importer.
 */
export function CsvColumnMapper({ importerKey, csvHeaders, requiredFields, onConfirm }: CsvColumnMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchImportMapping(importerKey)
      .then((res) => {
        if (cancelled) return;
        const saved = res.mapping ?? {};
        const initial: Record<string, string> = {};
        for (const field of requiredFields) {
          const savedHeader = saved[field.key];
          if (savedHeader && csvHeaders.includes(savedHeader)) {
            initial[field.key] = savedHeader;
            continue;
          }
          // Fall back to a case-insensitive exact match on the field key
          // itself, so a first-ever upload with sensibly-named columns
          // doesn't require mapping every field by hand.
          const guess = csvHeaders.find((h) => h.toLowerCase() === field.key.toLowerCase());
          if (guess) initial[field.key] = guess;
        }
        setMapping(initial);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importerKey]);

  const allMapped = requiredFields.every((f) => !!mapping[f.key]);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      await saveImportMapping(importerKey, mapping);
      onConfirm(mapping);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted py-4">Loading saved column mapping…</div>;
  }

  return (
    <div className="bg-surface border border-border rounded p-4 flex flex-col gap-3">
      <div className="text-sm font-medium text-secondary">Map your file's columns</div>
      <p className="text-xs text-muted">
        Tell us which column in your file is which — this is remembered for next time.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {requiredFields.map((field) => (
          <div key={field.key}>
            <label className="text-xs text-secondary mb-1 block">{field.label}</label>
            <select
              value={mapping[field.key] ?? ""}
              onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
              className={selectClass}
            >
              <option value="" disabled>
                Select column
              </option>
              {csvHeaders.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {error && <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1.5">{error}</div>}
      <button
        onClick={handleConfirm}
        disabled={!allMapped || saving}
        className="bg-accent text-accent-fg rounded py-1.5 px-4 text-sm font-medium hover:opacity-90 disabled:opacity-50 self-start"
      >
        {saving ? "Saving..." : "Confirm mapping"}
      </button>
    </div>
  );
}
