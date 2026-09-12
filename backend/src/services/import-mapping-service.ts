import { supabase } from "../supabase/client.js";

/** column_mapping shape: { [internalFieldKey]: csvHeaderName } */
export type ColumnMapping = Record<string, string>;

export async function getColumnMapping(importerKey: string): Promise<ColumnMapping | null> {
  const { data, error } = await supabase
    .from("import_column_mappings")
    .select("column_mapping")
    .eq("importer_key", importerKey)
    .maybeSingle();
  if (error) throw error;
  return (data?.column_mapping as ColumnMapping) ?? null;
}

export async function saveColumnMapping(importerKey: string, mapping: ColumnMapping): Promise<void> {
  const { error } = await supabase
    .from("import_column_mappings")
    .upsert(
      { importer_key: importerKey, column_mapping: mapping, updated_at: new Date().toISOString() },
      { onConflict: "importer_key" },
    );
  if (error) throw error;
}
