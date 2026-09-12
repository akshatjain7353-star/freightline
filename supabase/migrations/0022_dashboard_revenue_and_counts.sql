-- "Revenue" was summing cost_rupees (vendor cost paid to Delhivery) instead
-- of client_billed_amount (what clients actually pay Time Bound - the
-- company's real revenue). Confirmed with the user: fix it, since the new
-- GST-inclusive figure only makes sense computed on what's actually billed.
--
-- Role-based masking of money fields moves out of this view and into
-- backend/src/services/dashboard-service.ts instead, since only the backend
-- (service-role, bypassing RLS) queries this view now - the frontend no
-- longer reads it directly, so current_app_role() masking here would no
-- longer even resolve correctly (it depends on the *calling* session's
-- auth.uid(), not the service-role client's).

create or replace view dashboard_kpis as
select
  count(*)::bigint as total_shipments,
  coalesce(sum(client_billed_amount), 0)::numeric(12,2) as revenue,
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
  end as cod_share_pct,
  count(*) filter (where status = 'in_transit')::bigint as in_transit_count,
  (
    select count(*)
    from shipments s2
    where s2.awb is not null
      and not exists (
        select 1 from pickup_request pr
        where pr.shipment_id = s2.id and pr.direction = 'forward' and pr.status = 'completed'
      )
  )::bigint as not_picked_up_count
from shipments;
