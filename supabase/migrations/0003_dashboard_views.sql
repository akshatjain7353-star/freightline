-- Aggregation views backing the Dashboard KPIs and charts. Kept as views (not
-- app-side computation) so the numbers are always consistent with the raw
-- shipments table regardless of which client reads them.

create or replace view dashboard_kpis as
select
  count(*)::bigint as total_shipments,
  coalesce(sum(cost_rupees), 0)::numeric(12,2) as revenue,
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

-- 14-day daily revenue + volume trend.
create or replace view dashboard_trend_14d as
select
  d::date as day,
  coalesce(count(s.id), 0)::bigint as shipment_count,
  coalesce(sum(s.cost_rupees), 0)::numeric(12,2) as revenue
from generate_series(current_date - interval '13 days', current_date, interval '1 day') d
left join shipments s on s.created_at::date = d::date
group by d
order by d;

create or replace view dashboard_carrier_distribution as
select
  c.name as carrier_name,
  count(s.id)::bigint as shipment_count
from carriers c
left join shipments s on s.carrier_id = c.id
group by c.name
order by shipment_count desc;

-- Views are owned by the migration role and don't inherit RLS automatically;
-- grant explicit read access to the authenticated app role.
grant select on dashboard_kpis, dashboard_trend_14d, dashboard_carrier_distribution to authenticated;
