-- Pickup scheduling (forward) and reverse pickup (DTO returns), both modeled
-- as rows in one table distinguished by `direction`. A DTO reverse pickup
-- creates a *new* shipments row (its own AWB, related_shipment_id pointing
-- back to the original, per the confirmed design decision) — this table just
-- tracks the carrier-side pickup request for either direction.

create type pickup_direction as enum ('forward', 'reverse');
create type pickup_status as enum ('requested', 'scheduled', 'completed', 'failed', 'cancelled');

create table pickup_request (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  direction pickup_direction not null default 'forward',
  carrier_id uuid not null references carriers(id),
  pickup_date date not null,
  time_slot text,
  status pickup_status not null default 'requested',
  carrier_pickup_id text,
  raw_response jsonb,
  requested_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_pickup_request_shipment on pickup_request(shipment_id);

create trigger trg_pickup_request_updated_at
  before update on pickup_request
  for each row execute function set_updated_at();

alter table pickup_request enable row level security;

-- Read-only for authenticated (no cost data here); writes are Express-only
-- on the service-role key, same pattern as shipments itself.
create policy "pickup_request_select" on pickup_request for select to authenticated using (true);
