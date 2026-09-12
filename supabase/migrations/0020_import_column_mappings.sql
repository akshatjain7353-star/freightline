-- Remembers the column mapping a user picks for each CSV importer (Bulk
-- Upload, Carrier COD Remittance, Vendor Reconciliation), so it isn't
-- re-done on every upload. Global per importer type, not per user - the
-- CSV shape from a given source is consistent regardless of who uploads it.

create table import_column_mappings (
  id uuid primary key default gen_random_uuid(),
  importer_key text not null unique,
  column_mapping jsonb not null,
  updated_at timestamptz not null default now()
);

alter table import_column_mappings enable row level security;

create policy "import_column_mappings_all" on import_column_mappings for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
