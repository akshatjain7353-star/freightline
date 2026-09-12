-- Client-facing reverse-pickup (RTV/DTO) request API: lets an external
-- client system submit a request into Time Bound, staged for ops review
-- before a real (money-spending) carrier booking happens - mirrors the NDR
-- Queue's existing pattern of a queue of items needing a human decision.

create table client_api_keys (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  key_hash text not null unique,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index idx_client_api_keys_client on client_api_keys(client_id);

alter table client_api_keys enable row level security;

-- Credential issuance is stricter than pricing data - admin only, not
-- accounts_ops (which already sees rate_cards/client_invoice/etc).
create policy "client_api_keys_all" on client_api_keys for all to authenticated
  using (current_app_role() = 'admin')
  with check (current_app_role() = 'admin');

create type dto_request_status as enum ('pending', 'approved', 'rejected', 'booked');

create table dto_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  -- The client's own identifier for this request, so a retried submission
  -- doesn't create a duplicate - see the unique index below.
  external_reference text,
  customer_name text not null,
  customer_phone text,
  pickup_address_line text not null,
  pickup_city text not null,
  pickup_pincode text not null,
  destination_pincode text not null,
  weight_grams numeric(10,2) not null,
  length_cm numeric(8,2) not null,
  width_cm numeric(8,2) not null,
  height_cm numeric(8,2) not null,
  reason text,
  carrier_code text not null default 'delhivery',
  status dto_request_status not null default 'pending',
  created_shipment_id uuid references shipments(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create unique index uq_dto_requests_client_external_reference
  on dto_requests(client_id, external_reference)
  where external_reference is not null;

create index idx_dto_requests_status on dto_requests(status);

alter table dto_requests enable row level security;

-- Client-relationship data, same tier as client_invoice - admin + accounts_ops.
-- No policy for `authenticated` writes: both entry points (the external API
-- submission, and ops approve/reject) go through the service-role backend.
create policy "dto_requests_select" on dto_requests for select to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'));
