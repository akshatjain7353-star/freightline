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
