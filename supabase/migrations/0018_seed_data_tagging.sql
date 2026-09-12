-- Tagging columns so scripts/seed-demo-data.ts's rows can be identified and
-- fully removed later by scripts/cleanup-demo-data.ts, without touching any
-- real data that exists alongside it (e.g. the pre-existing "Test Client").
-- Only added to "root" tables - everything else seeded (client_rate_card_
-- slab_prices, client_invoice_line, carrier_remittance_line, tracking_events,
-- ndr_action_log) is identified transitively via its foreign key to one of
-- these, per the cleanup script's own comments on delete order.

alter table clients add column is_seed_data boolean not null default false;
alter table shipments add column is_seed_data boolean not null default false;
alter table client_rate_cards add column is_seed_data boolean not null default false;
alter table client_invoice add column is_seed_data boolean not null default false;
alter table client_payment add column is_seed_data boolean not null default false;
alter table carrier_remittance_batch add column is_seed_data boolean not null default false;
