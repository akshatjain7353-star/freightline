-- Client tracking portal.
--
-- Internal ops stay on app_role (admin / accounts_ops / ops_only) via
-- user_roles. Shipper accounts are a separate link table so they never
-- inherit ops policies. A user should be in one or the other, not both.

create table client_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_client_users_client_id on client_users(client_id);

create or replace function current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id from client_users where user_id = auth.uid()
$$;

create or replace function is_ops_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_app_role() is not null
$$;

grant execute on function current_client_id() to authenticated;
grant execute on function is_ops_user() to authenticated;

alter table client_users enable row level security;

create policy "client_users_read_own" on client_users
  for select to authenticated
  using (user_id = auth.uid() or is_ops_user());

-- ---------------------------------------------------------------------------
-- Scope rows that were previously "any authenticated user sees everything".
-- Service-role (backend + poller) still bypasses RLS.
-- ---------------------------------------------------------------------------

drop policy if exists "clients_select" on clients;
create policy "clients_select" on clients
  for select to authenticated
  using (is_ops_user() or id = current_client_id());

drop policy if exists "shipments_select" on shipments;
create policy "shipments_select" on shipments
  for select to authenticated
  using (is_ops_user() or client_id = current_client_id());

drop policy if exists "tracking_events_select" on tracking_events;
create policy "tracking_events_select" on tracking_events
  for select to authenticated
  using (
    is_ops_user()
    or exists (
      select 1 from shipments s
      where s.id = tracking_events.shipment_id
        and s.client_id = current_client_id()
    )
  );

drop policy if exists "pickup_request_select" on pickup_request;
create policy "pickup_request_select" on pickup_request
  for select to authenticated
  using (is_ops_user());

drop policy if exists "ndr_action_log_select" on ndr_action_log;
create policy "ndr_action_log_select" on ndr_action_log
  for select to authenticated
  using (is_ops_user());

drop policy if exists "exception_log_select" on exception_log;
create policy "exception_log_select" on exception_log
  for select to authenticated
  using (is_ops_user());

drop policy if exists "authenticated_full_access" on client_integrations;
create policy "client_integrations_ops" on client_integrations
  for all to authenticated
  using (is_ops_user())
  with check (is_ops_user());

-- Ops list/detail view must not leak every shipment (and costs) to a
-- client JWT. Views run as owner and would otherwise bypass shipments RLS.
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
left join carriers cr on cr.id = s.carrier_id
where is_ops_user();

grant select on shipments_ops_view to authenticated;

-- Client portal view: own shipments only, no cost / billed columns.
create view shipments_client_view as
select
  s.id,
  s.awb,
  s.order_id,
  s.client_id,
  c.name as client_name,
  cr.name as carrier_name,
  s.origin_pincode,
  s.destination_pincode,
  s.destination_address_line,
  s.destination_city,
  s.weight_grams,
  s.chargeable_weight_grams,
  s.payment_mode,
  s.status,
  s.created_at,
  s.updated_at
from shipments s
left join clients c on c.id = s.client_id
left join carriers cr on cr.id = s.carrier_id
where s.client_id = current_client_id();

grant select on shipments_client_view to authenticated;
