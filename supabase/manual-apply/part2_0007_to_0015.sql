-- Part 2 of 2: run only after part 1 has succeeded.

-- Three fixes to the shipments table, bundled because they're all needed
-- before the pickup/NDR/DTO work in later migrations can function:
--
-- 1. Destination address was never persisted, even though CreateShipmentInput
--    always carried addressLine/city and sent them to the carrier — this
--    silently blocked NDR's "edit delivery address" action.
-- 2. related_shipment_id lets a DTO be modeled as a new linked shipment (its
--    own AWB, booked as a real reverse pickup) rather than a same-row status
--    flip, per the confirmed design decision.
-- 3. Weight discrepancy capture + a flat-10%-threshold flag, per the
--    confirmed decision (not scaled by weight, not a bare-grams cutoff).

alter table shipments add column destination_address_line text;
alter table shipments add column destination_city text;
alter table shipments add column related_shipment_id uuid references shipments(id);

alter table shipments add column vendor_charged_weight numeric(10,2);
alter table shipments add column weight_discrepancy_flagged boolean not null default false;
alter table shipments add column weight_discrepancy_status text
  check (weight_discrepancy_status in ('flagged', 'accepted', 'disputed', 'resolved'));

create or replace function set_weight_discrepancy_flag()
returns trigger as $$
begin
  if new.vendor_charged_weight is not null and new.chargeable_weight_grams > 0 then
    new.weight_discrepancy_flagged :=
      abs(new.vendor_charged_weight - new.chargeable_weight_grams) / new.chargeable_weight_grams > 0.10;
  else
    new.weight_discrepancy_flagged := false;
  end if;

  -- Only auto-set to 'flagged' the first time a discrepancy appears — never
  -- overwrite an ops decision (accepted/disputed/resolved) on a later write.
  if new.weight_discrepancy_flagged and new.weight_discrepancy_status is null then
    new.weight_discrepancy_status := 'flagged';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_shipments_weight_discrepancy
  before insert or update of vendor_charged_weight on shipments
  for each row execute function set_weight_discrepancy_flag();

-- Refresh the ops view with the new columns. None of these are cost data, so
-- no ops_only masking needed here — same pattern as rate_card_id.
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
  s.related_shipment_id,
  case when current_app_role() = 'ops_only' then null else s.cost_rupees end as cost_rupees,
  case when current_app_role() = 'ops_only' then null else s.cod_charge_rupees end as cod_charge_rupees,
  s.created_at,
  s.updated_at
from shipments s
left join clients c on c.id = s.client_id
left join carriers cr on cr.id = s.carrier_id;

grant select on shipments_ops_view to authenticated;

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

-- NDR as a real workflow, not just a status pill. Reattempt limit is
-- vendor-specific per the confirmed decision (carriers.max_ndr_attempts),
-- not a global constant.

alter table carriers add column max_ndr_attempts integer not null default 3;
alter table shipments add column ndr_attempt_count integer not null default 0;

create type ndr_action_type as enum ('reattempt_requested', 'address_edited', 'customer_contacted', 'converted_to_rto');

create table ndr_action_log (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  action ndr_action_type not null,
  notes text,
  performed_by uuid references auth.users(id),
  attempt_number integer,
  created_at timestamptz not null default now()
);

create index idx_ndr_action_log_shipment on ndr_action_log(shipment_id);

alter table ndr_action_log enable row level security;
create policy "ndr_action_log_select" on ndr_action_log for select to authenticated using (true);

-- Surface ndr_attempt_count on the ops view (operational fact, not cost —
-- same treatment as the other non-cost columns already exposed there).
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
  s.related_shipment_id,
  s.ndr_attempt_count,
  case when current_app_role() = 'ops_only' then null else s.cost_rupees end as cost_rupees,
  case when current_app_role() = 'ops_only' then null else s.cod_charge_rupees end as cod_charge_rupees,
  s.created_at,
  s.updated_at
from shipments s
left join clients c on c.id = s.client_id
left join carriers cr on cr.id = s.carrier_id;

grant select on shipments_ops_view to authenticated;

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

-- GST-compliant invoice schema + generation logic (Phase 1.5 per the spec's
-- phase roadmap). The full client billing/ledger UI stays Phase 2 — this is
-- the schema plus a bare-bones trigger-and-list admin page.

alter table clients add column gstin text;
-- Needed to determine CGST+SGST (intra-state) vs IGST (inter-state) — a real
-- gap the invoice schema can't skip. Time Bound's own origin state isn't
-- captured anywhere either; assume it's supplied via a future settings
-- table or env var when the tax-split logic is actually implemented.
alter table clients add column billing_state text;

create sequence client_invoice_number_seq;

-- Placeholder format (INV/<year>/<seq>) — confirm the real numbering format
-- with whoever handles Time Bound's GST filing before invoices go out for
-- real; sequential/unique-per-financial-year is the only hard legal
-- requirement, the string shape itself isn't prescribed.
create or replace function next_invoice_number()
returns text
language sql
as $$
  select 'INV/' || to_char(current_date, 'YYYY') || '/' || lpad(nextval('client_invoice_number_seq')::text, 6, '0');
$$;

create table client_invoice (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  invoice_number text not null unique default next_invoice_number(),
  period_from date not null,
  period_to date not null,
  subtotal_rupees numeric(12,2) not null default 0,
  tax_rupees numeric(12,2) not null default 0,
  total_rupees numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table client_invoice_line (
  id uuid primary key default gen_random_uuid(),
  client_invoice_id uuid not null references client_invoice(id) on delete cascade,
  shipment_id uuid references shipments(id),
  description text not null,
  amount_rupees numeric(12,2) not null,
  tax_type text not null check (tax_type in ('cgst_sgst', 'igst')),
  tax_rupees numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index idx_client_invoice_client on client_invoice(client_id);
create index idx_client_invoice_line_invoice on client_invoice_line(client_invoice_id);

alter table client_invoice enable row level security;
alter table client_invoice_line enable row level security;

-- Pricing/billing data — same admin+accounts_ops-only treatment as rate_cards.
create policy "client_invoice_all" on client_invoice for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "client_invoice_line_all" on client_invoice_line for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));

-- Mirror of COD reconciliation (Phase 2), but matched against
-- shipment.cost_rupees (accounting for weight-discrepancy) instead of
-- order_value — what a vendor actually bills Time Bound vs. what was quoted
-- at booking.

create table vendor_invoice_batch (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references carriers(id),
  file_name text,
  uploaded_by uuid references auth.users(id),
  total_lines integer not null default 0,
  matched_lines integer not null default 0,
  discrepancy_lines integer not null default 0,
  created_at timestamptz not null default now()
);

create table vendor_invoice_line (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references vendor_invoice_batch(id) on delete cascade,
  awb text not null,
  shipment_id uuid references shipments(id),
  vendor_billed_amount_rupees numeric(12,2) not null,
  expected_amount_rupees numeric(12,2),
  discrepancy_rupees numeric(12,2),
  status text not null default 'unmatched' check (status in ('matched', 'discrepancy', 'unmatched')),
  created_at timestamptz not null default now()
);

create index idx_vendor_invoice_line_batch on vendor_invoice_line(batch_id);
create index idx_vendor_invoice_line_awb on vendor_invoice_line(awb);

alter table vendor_invoice_batch enable row level security;
alter table vendor_invoice_line enable row level security;

create policy "vendor_invoice_batch_all" on vendor_invoice_batch for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "vendor_invoice_line_all" on vendor_invoice_line for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));

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

-- Order-level financial visibility (spec Section 9): client price charged,
-- vendor price paid, payment mode, and collection status side by side.
-- client_billed_amount and cost_rupees already exist; this adds the missing
-- piece — where a COD shipment's cash currently sits.

alter table shipments add column cod_collection_status text not null default 'pending'
  check (cod_collection_status in ('pending', 'collected', 'remitted'));

-- Operational status, not a price figure — no ops_only masking needed, same
-- treatment as weight_discrepancy_status.
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

-- Carrier COD remittance reconciliation (mirrors vendor_invoice_batch/line
-- from 0012_vendor_reconciliation.sql, but matching what the carrier remits
-- to Time Bound against shipments, not what they bill for freight) plus the
-- client ledger core (spec Section 12): two money flows per client —
--   freight (client owes Time Bound): freight_debit on invoice, freight_credit
--   on payment received
--   COD (Time Bound owes client): cod_credit when the carrier remits COD to
--   Time Bound on the client's behalf, cod_debit when Time Bound remits it
--   onward to the client
-- settlement_mode (0013) decides how a client's ledger is displayed/settled:
-- netted clients get one combined running balance settled per-period
-- (client_settlement_run); separate clients get two independent balances.

create table carrier_remittance_batch (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references carriers(id),
  file_name text,
  uploaded_by uuid references auth.users(id),
  total_lines integer not null default 0,
  matched_lines integer not null default 0,
  created_at timestamptz not null default now()
);

create table carrier_remittance_line (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references carrier_remittance_batch(id) on delete cascade,
  awb text not null,
  shipment_id uuid references shipments(id),
  remitted_amount_rupees numeric(12,2) not null,
  status text not null default 'unmatched' check (status in ('matched', 'unmatched')),
  created_at timestamptz not null default now()
);

create index idx_carrier_remittance_line_batch on carrier_remittance_line(batch_id);
create index idx_carrier_remittance_line_awb on carrier_remittance_line(awb);

create table client_payment (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  amount_rupees numeric(12,2) not null,
  payment_date date not null,
  reference text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table client_settlement_run (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  period_from date not null,
  period_to date not null,
  freight_total_rupees numeric(12,2) not null default 0,
  cod_total_rupees numeric(12,2) not null default 0,
  -- positive = Time Bound pays the client this amount; negative = client
  -- still owes Time Bound this amount for the period.
  net_amount_rupees numeric(12,2) not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create type client_ledger_entry_type as enum ('freight_debit', 'freight_credit', 'cod_credit', 'cod_debit');

create table client_ledger_entry (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  entry_type client_ledger_entry_type not null,
  amount_rupees numeric(12,2) not null,
  description text not null,
  shipment_id uuid references shipments(id),
  client_invoice_id uuid references client_invoice(id),
  client_payment_id uuid references client_payment(id),
  carrier_remittance_line_id uuid references carrier_remittance_line(id),
  -- Set once a netted-client entry is folded into a period-close run — an
  -- unassigned (null) entry in a netted client's ledger is still awaiting
  -- settlement. Prevents a later overlapping settle-period run from
  -- double-counting it.
  settlement_run_id uuid references client_settlement_run(id),
  created_at timestamptz not null default now()
);

create index idx_client_ledger_entry_client on client_ledger_entry(client_id, created_at);
create index idx_client_ledger_entry_settlement on client_ledger_entry(settlement_run_id);

alter table carrier_remittance_batch enable row level security;
alter table carrier_remittance_line enable row level security;
alter table client_payment enable row level security;
alter table client_settlement_run enable row level security;
alter table client_ledger_entry enable row level security;

-- All pricing/money-movement data — same admin+accounts_ops-only treatment
-- as rate_cards and client_invoice.
create policy "carrier_remittance_batch_all" on carrier_remittance_batch for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "carrier_remittance_line_all" on carrier_remittance_line for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "client_payment_all" on client_payment for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "client_settlement_run_all" on client_settlement_run for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "client_ledger_entry_all" on client_ledger_entry for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));

-- Section 9's third collection-status value: 'collected' means the carrier
-- has remitted the COD to Time Bound (this migration's reconciliation flow);
-- 'remitted' means Time Bound has since passed it on to the client
-- (Stage D's settlement run / separate-mode COD remittance-out).

