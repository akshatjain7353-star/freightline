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
