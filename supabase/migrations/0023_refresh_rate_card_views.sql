-- Real bug found live: 0021_dto_rates_and_cod_charge_fields.sql added
-- cod_charge_percent/cod_charge_minimum_rupees to rate_cards and
-- client_rate_cards, but a "select *" view's column list is fixed at
-- creation/last-replace time in Postgres - it does NOT pick up columns
-- added to the underlying table afterward. current_rate_cards and
-- current_client_rate_cards (0005/0013) were never re-run, so they were
-- still missing both new columns entirely - breaking getCurrentRateCard and
-- getCurrentClientRateCard for every quote and booking (rate calculator,
-- create shipment, bulk upload, DTO, client billing - all of it).

create or replace view current_rate_cards as
select * from rate_cards where effective_to is null and active;

create or replace view current_client_rate_cards as
select * from client_rate_cards where effective_to is null and active;
