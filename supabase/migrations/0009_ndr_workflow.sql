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
