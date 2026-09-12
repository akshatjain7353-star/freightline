-- Distinct from the NDR queue (a delivery problem at the vendor): this is
-- the SYSTEM failing to do something — a failed booking API call, or a
-- tracking-poll fetch that errored out. Both were previously silent beyond
-- server console logs.

create table exception_log (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('booking', 'tracking_poll')),
  shipment_id uuid references shipments(id) on delete set null,
  carrier_id uuid references carriers(id),
  error_message text not null,
  raw_context jsonb,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_exception_log_status on exception_log(status);
create index idx_exception_log_created_at on exception_log(created_at);

alter table exception_log enable row level security;

create policy "exception_log_select" on exception_log for select to authenticated using (true);
-- Writes are Express-only (service-role), same pattern as shipments.
