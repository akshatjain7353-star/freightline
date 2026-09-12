-- Client rate cards: the sell-side mirror of vendor rate_cards (spec
-- Section 1) — same zone-wise slab structure and versioning pattern as
-- 0005_rate_card_versioning.sql, keyed to client_id instead of carrier_id
-- since each client negotiates their own pricing. This is what lets
-- shipments carry a client_billed_amount alongside cost_rupees (Section 9's
-- "client price charged" vs "vendor price paid").

create table client_rate_cards (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  fuel_surcharge_percent numeric(6,3) not null default 0,
  effective_from date not null default current_date,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index uq_client_rate_cards_current_per_client
  on client_rate_cards(client_id)
  where effective_to is null and active;

create table client_rate_card_slab_prices (
  id uuid primary key default gen_random_uuid(),
  client_rate_card_id uuid not null references client_rate_cards(id) on delete cascade,
  slab_key text not null check (slab_key in (
    'flat_0_250',
    'flat_upto_500',
    'flat_upto_5000',
    'flat_upto_10000',
    'additional_500g_500_to_5000',
    'additional_1kg_5000_to_10000',
    'additional_1kg_beyond_10000'
  )),
  zone_code text not null references zones(zone_code),
  price_rupees numeric(10,2) not null,
  unique (client_rate_card_id, slab_key, zone_code)
);

-- Not granted to `authenticated` — same treatment as current_rate_cards
-- (0005_rate_card_versioning.sql): only the backend's service-role client
-- reads this, rate cards stay behind their own pricing-gated RLS below.
create or replace view current_client_rate_cards as
select * from client_rate_cards where effective_to is null and active;

alter table client_rate_cards enable row level security;
alter table client_rate_card_slab_prices enable row level security;

create policy "client_rate_cards_all" on client_rate_cards for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "client_rate_card_slab_prices_all" on client_rate_card_slab_prices for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));

-- shipments: client_billed_amount is the sell-side counterpart to
-- cost_rupees. Null until the client has a rate card — billing is deferred,
-- not guessed, for clients without one yet.
alter table shipments add column client_billed_amount numeric(10,2);
alter table shipments add column client_cod_charge_rupees numeric(10,2) not null default 0;
alter table shipments add column client_rate_card_id uuid references client_rate_cards(id);

-- Per-client setting alongside preferred vendor: netted (one combined
-- running balance, netted per-period) vs separate (two balances, freight
-- and COD handled independently). Confirmed decision: per-period netting.
alter table clients add column settlement_mode text not null default 'separate'
  check (settlement_mode in ('netted', 'separate'));

-- Refresh the ops view: client_billed_amount/client_cod_charge_rupees are
-- pricing/margin data too (margin = client_billed_amount - cost_rupees) —
-- mask them from ops_only exactly like cost_rupees/cod_charge_rupees.
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
