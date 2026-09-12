-- Real RBAC. Phase 1 was scoped to ship 3 internal roles (Admin / Accounts &
-- Operations / Operations-only) but only ever shipped a single blanket
-- "authenticated_full_access" policy (0002_rls.sql). This migration replaces
-- that with per-table, per-role policies, plus column-level masking (via a
-- view + revoked base-table grant) for the two places cost/revenue numbers
-- live but must stay hidden from Operations-only: shipments and the
-- dashboard views.
--
-- Role -> screen mapping (per functional spec Section 11):
--   admin        — full access to everything.
--   accounts_ops — full operational access, plus can view/edit rate cards
--                  (client + vendor pricing).
--   ops_only     — new orders, tracking, dashboard only. No pricing access:
--                  cannot see rate cards at all, and cost/revenue figures are
--                  masked to null everywhere else (Shipments list, Dashboard).
--                  The Rate Calculator is a pricing tool and is blocked
--                  outright for this role at the route level (frontend +
--                  backend), not just masked.

create type app_role as enum ('admin', 'accounts_ops', 'ops_only');

create table user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now()
);

-- security definer so this can be called from other tables' RLS policies
-- without those policies needing direct select access to user_roles (which
-- would otherwise recurse through user_roles' own RLS).
create or replace function current_app_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from user_roles where user_id = auth.uid()
$$;

grant execute on function current_app_role() to authenticated;

alter table user_roles enable row level security;

create policy "read_own_role" on user_roles
  for select to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete policy for `authenticated` — role assignment is
-- done via the Supabase SQL editor / service-role client for now. A small
-- number of internal ops accounts; a "manage users" admin UI is a follow-up.

-- ---------------------------------------------------------------------------
-- Replace the blanket policy on tables that need real role differentiation.
-- zones/metro_cities/pincode_master/pincode_zone_map/client_integrations keep
-- their existing blanket policy — they're operational reference data, not
-- pricing, and any authenticated ops user should be able to fix a bad
-- pincode entry directly.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['clients', 'carriers', 'rate_cards', 'rate_card_slab_prices', 'tracking_events', 'shipments']
  loop
    execute format('drop policy if exists "authenticated_full_access" on %I;', t);
  end loop;
end $$;

-- clients: read open to all; write restricted to admin + accounts_ops.
create policy "clients_select" on clients for select to authenticated using (true);
create policy "clients_insert" on clients for insert to authenticated
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "clients_update" on clients for update to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "clients_delete" on clients for delete to authenticated
  using (current_app_role() = 'admin');

-- carriers: read open to all (needed for the Create Shipment dropdown);
-- write restricted to admin only (carrier contract/API config).
create policy "carriers_select" on carriers for select to authenticated using (true);
create policy "carriers_insert" on carriers for insert to authenticated
  with check (current_app_role() = 'admin');
create policy "carriers_update" on carriers for update to authenticated
  using (current_app_role() = 'admin')
  with check (current_app_role() = 'admin');
create policy "carriers_delete" on carriers for delete to authenticated
  using (current_app_role() = 'admin');

-- rate_cards / rate_card_slab_prices: pricing data. ops_only gets zero rows,
-- not masked columns — they shouldn't know rate cards exist at all.
create policy "rate_cards_all" on rate_cards for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "rate_card_slab_prices_all" on rate_card_slab_prices for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));

-- tracking_events: read-only for authenticated. Only the service-role
-- tracking poller ever writes here.
create policy "tracking_events_select" on tracking_events for select to authenticated using (true);

-- shipments: read open to all roles at the row level (no client-scoping is
-- requested by the spec — all three internal roles see all shipments).
-- No insert/update/delete policy for `authenticated` at all: both write
-- paths (create + bulk upload) go through the Express backend on the
-- service-role key, never directly from the frontend.
create policy "shipments_select" on shipments for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Column-level masking for shipments: RLS is row-level only, so hiding
-- cost_rupees/cod_charge_rupees from ops_only (while admin/accounts_ops see
-- the same rows in full) needs a view + revoking direct table access.
-- Views run with the *owner's* privileges (not the querying role's), so this
-- view can still read the raw shipments table after the grant below is
-- revoked — see the same pattern already used for the dashboard views in
-- 0003_dashboard_views.sql.
-- ---------------------------------------------------------------------------

revoke select on shipments from authenticated;

create or replace view shipments_ops_view as
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
  s.weight_grams,
  s.chargeable_weight_grams,
  s.zone_code,
  s.zone_source,
  s.payment_mode,
  s.status,
  case when current_app_role() = 'ops_only' then null else s.cost_rupees end as cost_rupees,
  case when current_app_role() = 'ops_only' then null else s.cod_charge_rupees end as cod_charge_rupees,
  s.created_at,
  s.updated_at
from shipments s
left join clients c on c.id = s.client_id
left join carriers cr on cr.id = s.carrier_id;

grant select on shipments_ops_view to authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard views: same masking treatment for revenue.
-- ---------------------------------------------------------------------------

create or replace view dashboard_kpis as
select
  count(*)::bigint as total_shipments,
  -- Cast the whole CASE, not just the non-null branch: Postgres drops the
  -- numeric(12,2) typmod through a CASE expression, so casting only the
  -- inner value leaves the column as unconstrained `numeric`, which then
  -- fails `create or replace view` against the original 0003 column type.
  (case when current_app_role() = 'ops_only' then null
    else coalesce(sum(cost_rupees), 0)
  end)::numeric(12,2) as revenue,
  case when count(*) = 0 then 0
    else round(100.0 * count(*) filter (where status = 'delivered') / count(*), 2)
  end as delivered_pct,
  case when count(*) = 0 then 0
    else round(100.0 * count(*) filter (where status = 'ndr') / count(*), 2)
  end as ndr_pct,
  case when count(*) = 0 then 0
    else round(100.0 * count(*) filter (where status = 'rto') / count(*), 2)
  end as rto_pct,
  case when count(*) = 0 then 0
    else round(100.0 * count(*) filter (where payment_mode = 'COD') / count(*), 2)
  end as cod_share_pct
from shipments;

create or replace view dashboard_trend_14d as
select
  d::date as day,
  coalesce(count(s.id), 0)::bigint as shipment_count,
  (case when current_app_role() = 'ops_only' then null
    else coalesce(sum(s.cost_rupees), 0)
  end)::numeric(12,2) as revenue
from generate_series(current_date - interval '13 days', current_date, interval '1 day') d
left join shipments s on s.created_at::date = d::date
group by d
order by d;

grant select on dashboard_kpis, dashboard_trend_14d to authenticated;

-- ---------------------------------------------------------------------------
-- Audit trail. Every mutating service added from this point on (rate-card
-- edits, pickup scheduling, NDR actions, invoice generation, ...) writes
-- here via a shared backend helper.
-- ---------------------------------------------------------------------------

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_log_entity on audit_log(entity_type, entity_id);
create index idx_audit_log_created_at on audit_log(created_at);

alter table audit_log enable row level security;

-- Readable by admin + accounts_ops (matters most during a pricing/routing
-- dispute); written only by the backend's service-role client.
create policy "audit_log_select" on audit_log for select to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'));

-- Rate card versioning. Client-billed/vendor-cost amounts are already stored
-- per-shipment at booking time, but the rate CARD itself was overwritten on
-- edit with no history. This adds an effective_to date so editing means
-- "close the old version, open a new one" instead of mutating in place, and
-- ties each shipment to the exact version that priced it.

alter table rate_cards add column effective_to date;

-- Enforces "at most one open version per carrier" at the DB level, not just
-- in application code.
create unique index uq_rate_cards_current_per_carrier
  on rate_cards(carrier_id)
  where effective_to is null and active;

-- Not granted to `authenticated` — rate cards stay behind rate_cards' own
-- pricing-gated RLS (0004_rbac.sql). Only the backend's service-role client
-- reads this view (the live rate lookup in rate.ts, and the new rate-card
-- admin routes), matching how rate_cards/rate_card_slab_prices are already
-- ops_only-invisible at the row level.
create or replace view current_rate_cards as
select * from rate_cards where effective_to is null and active;

alter table shipments add column rate_card_id uuid references rate_cards(id);

-- Expose it on the ops-facing view too (not cost data, just a reference —
-- useful once vendor invoice reconciliation needs to recompute an "expected"
-- amount against the specific rate card version active at booking time).
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
  s.weight_grams,
  s.chargeable_weight_grams,
  s.zone_code,
  s.zone_source,
  s.payment_mode,
  s.status,
  s.rate_card_id,
  case when current_app_role() = 'ops_only' then null else s.cost_rupees end as cost_rupees,
  case when current_app_role() = 'ops_only' then null else s.cod_charge_rupees end as cod_charge_rupees,
  s.created_at,
  s.updated_at
from shipments s
left join clients c on c.id = s.client_id
left join carriers cr on cr.id = s.carrier_id;

grant select on shipments_ops_view to authenticated;

-- Postgres requires a new enum value to be committed before it can be used
-- in the same session, so this is a standalone migration ahead of the
-- shipment-schema changes in 0007 that will eventually produce 'dto' rows.
alter type shipment_status add value if not exists 'dto';
