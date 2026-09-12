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
