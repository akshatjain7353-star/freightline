-- Unicommerce "shipper" (courier-partner) integration. Uniware calls Time
-- Bound's servers directly (not the reverse) whenever a client ships an
-- order via Time Bound from inside their own Unicommerce panel. This is a
-- different direction/shape from client_integrations (0001_schema.sql),
-- which was built for Time Bound authenticating outward to a client's own
-- Shopify/Unicommerce account — that table's intent doesn't match issuing
-- credentials for someone else to authenticate to us with, hence the new
-- tables here rather than overloading it.

create table unicommerce_seller_credentials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  username text not null unique,
  password_hash text not null,
  label text not null default 'Unicommerce integration',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_unicommerce_seller_credentials_client on unicommerce_seller_credentials(client_id);

alter table unicommerce_seller_credentials enable row level security;

create policy "unicommerce_seller_credentials_all" on unicommerce_seller_credentials for all to authenticated
  using (current_app_role() = 'admin')
  with check (current_app_role() = 'admin');

-- One active session per client - a fresh /authToken call replaces the
-- previous row rather than accumulating old ones.
create table unicommerce_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade unique,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

alter table unicommerce_sessions enable row level security;

create policy "unicommerce_sessions_all" on unicommerce_sessions for all to authenticated
  using (current_app_role() = 'admin')
  with check (current_app_role() = 'admin');

alter table shipments add column source text not null default 'manual'
  check (source in ('manual', 'bulk_upload', 'unicommerce'));

drop view if exists shipments_ops_view;
create view shipments_ops_view as
select
  s.id,
  s.awb,
  s.order_id,
  s.client_id,
  s.carrier_id,
  c.name as client_name,
  cr.name as carrier_name,
  s.origin_pincode,
  s.destination_pincode,
  s.destination_address_line,
  s.destination_city,
  s.weight_grams,
  s.chargeable_weight_grams,
  s.vendor_charged_weight,
  s.weight_discrepancy_flagged,
  s.weight_discrepancy_status,
  s.zone_code,
  s.zone_source,
  s.payment_mode,
  s.status,
  s.source,
  s.cod_collection_status,
  s.rate_card_id,
  s.client_rate_card_id,
  s.related_shipment_id,
  s.ndr_attempt_count,
  case when current_app_role() = 'ops_only' then null else s.cost_rupees end as cost_rupees,
  case when current_app_role() = 'ops_only' then null else s.cod_charge_rupees end as cod_charge_rupees,
  case when current_app_role() = 'ops_only' then null else s.client_billed_amount end as client_billed_amount,
  case when current_app_role() = 'ops_only' then null else s.client_cod_charge_rupees end as client_cod_charge_rupees,
  s.created_at,
  s.updated_at
from shipments s
left join clients c on c.id = s.client_id
left join carriers cr on cr.id = s.carrier_id;

grant select on shipments_ops_view to authenticated;
