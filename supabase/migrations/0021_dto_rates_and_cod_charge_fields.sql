-- DTO (customer-initiated return) has its own distinct pricing from the
-- forward ("DL") rate card, never modeled before. Adds a rate_type column
-- to both the vendor and client slab-price tables (rather than a parallel
-- table) so the existing versioning/editing UI can handle both with one
-- extra tab, instead of duplicating that machinery. RTO is unaffected - it
-- reuses the forward table unchanged, since it's a status flip, not a
-- re-quote.

alter table rate_card_slab_prices add column rate_type text not null default 'forward'
  check (rate_type in ('forward', 'dto'));
alter table client_rate_card_slab_prices add column rate_type text not null default 'forward'
  check (rate_type in ('forward', 'dto'));

-- Replace (rate_card_id, slab_key, zone_code) with a constraint that
-- includes rate_type - forward and dto share the same slab_key/zone_code
-- values, so the old constraint would block inserting a dto row alongside
-- its forward counterpart. Looked up by column membership rather than a
-- hardcoded name, since Postgres may have truncated the auto-generated
-- constraint name to fit NAMEDATALEN (63 bytes).
do $$
declare
  con_name text;
begin
  select con.conname into con_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'rate_card_slab_prices' and con.contype = 'u';
  if con_name is not null then
    execute format('alter table rate_card_slab_prices drop constraint %I', con_name);
  end if;

  select con.conname into con_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'client_rate_card_slab_prices' and con.contype = 'u';
  if con_name is not null then
    execute format('alter table client_rate_card_slab_prices drop constraint %I', con_name);
  end if;
end $$;

alter table rate_card_slab_prices
  add constraint rate_card_slab_prices_unique unique (rate_card_id, slab_key, zone_code, rate_type);
alter table client_rate_card_slab_prices
  add constraint client_rate_card_slab_prices_unique unique (client_rate_card_id, slab_key, zone_code, rate_type);

-- COD charge was hardcoded (1% of value or Rs.20 minimum, whichever is
-- higher) despite being carrier/client-editable in principle - versioned
-- the same way as fuel_surcharge_percent.
alter table rate_cards add column cod_charge_percent numeric(5,2) not null default 1;
alter table rate_cards add column cod_charge_minimum_rupees numeric(10,2) not null default 20;
alter table client_rate_cards add column cod_charge_percent numeric(5,2) not null default 1;
alter table client_rate_cards add column cod_charge_minimum_rupees numeric(10,2) not null default 20;

-- Seed the DTO slab prices onto the current Delhivery rate card (whichever
-- version is currently open, not a hardcoded id, in case a new version has
-- since been published via the Rate Cards admin page).
do $$
declare
  v_rate_card_id uuid;
begin
  select cr.id into v_rate_card_id
  from current_rate_cards cr
  join carriers c on c.id = cr.carrier_id
  where c.code = 'delhivery';

  if v_rate_card_id is null then
    raise exception 'No current Delhivery rate card found - run the base migrations/seed first.';
  end if;

  insert into rate_card_slab_prices (rate_card_id, slab_key, zone_code, price_rupees, rate_type)
  values
    (v_rate_card_id, 'flat_0_250', 'A', 43, 'dto'),
    (v_rate_card_id, 'flat_0_250', 'B', 49, 'dto'),
    (v_rate_card_id, 'flat_0_250', 'C1', 49, 'dto'),
    (v_rate_card_id, 'flat_0_250', 'C2', 51, 'dto'),
    (v_rate_card_id, 'flat_0_250', 'D1', 53, 'dto'),
    (v_rate_card_id, 'flat_0_250', 'D2', 54, 'dto'),
    (v_rate_card_id, 'flat_0_250', 'E', 66, 'dto'),
    (v_rate_card_id, 'flat_0_250', 'F', 73, 'dto'),

    (v_rate_card_id, 'flat_upto_500', 'A', 50, 'dto'),
    (v_rate_card_id, 'flat_upto_500', 'B', 56, 'dto'),
    (v_rate_card_id, 'flat_upto_500', 'C1', 61, 'dto'),
    (v_rate_card_id, 'flat_upto_500', 'C2', 65, 'dto'),
    (v_rate_card_id, 'flat_upto_500', 'D1', 65, 'dto'),
    (v_rate_card_id, 'flat_upto_500', 'D2', 68, 'dto'),
    (v_rate_card_id, 'flat_upto_500', 'E', 81, 'dto'),
    (v_rate_card_id, 'flat_upto_500', 'F', 90, 'dto'),

    (v_rate_card_id, 'additional_500g_500_to_5000', 'A', 12, 'dto'),
    (v_rate_card_id, 'additional_500g_500_to_5000', 'B', 20, 'dto'),
    (v_rate_card_id, 'additional_500g_500_to_5000', 'C1', 27, 'dto'),
    (v_rate_card_id, 'additional_500g_500_to_5000', 'C2', 36, 'dto'),
    (v_rate_card_id, 'additional_500g_500_to_5000', 'D1', 36, 'dto'),
    (v_rate_card_id, 'additional_500g_500_to_5000', 'D2', 41, 'dto'),
    (v_rate_card_id, 'additional_500g_500_to_5000', 'E', 49, 'dto'),
    (v_rate_card_id, 'additional_500g_500_to_5000', 'F', 54, 'dto'),

    (v_rate_card_id, 'flat_upto_5000', 'A', 153, 'dto'),
    (v_rate_card_id, 'flat_upto_5000', 'B', 212, 'dto'),
    (v_rate_card_id, 'flat_upto_5000', 'C1', 271, 'dto'),
    (v_rate_card_id, 'flat_upto_5000', 'C2', 297, 'dto'),
    (v_rate_card_id, 'flat_upto_5000', 'D1', 303, 'dto'),
    (v_rate_card_id, 'flat_upto_5000', 'D2', 315, 'dto'),
    (v_rate_card_id, 'flat_upto_5000', 'E', 382, 'dto'),
    (v_rate_card_id, 'flat_upto_5000', 'F', 424, 'dto'),

    (v_rate_card_id, 'additional_1kg_5000_to_10000', 'A', 32, 'dto'),
    (v_rate_card_id, 'additional_1kg_5000_to_10000', 'B', 36, 'dto'),
    (v_rate_card_id, 'additional_1kg_5000_to_10000', 'C1', 43, 'dto'),
    (v_rate_card_id, 'additional_1kg_5000_to_10000', 'C2', 46, 'dto'),
    (v_rate_card_id, 'additional_1kg_5000_to_10000', 'D1', 49, 'dto'),
    (v_rate_card_id, 'additional_1kg_5000_to_10000', 'D2', 54, 'dto'),
    (v_rate_card_id, 'additional_1kg_5000_to_10000', 'E', 65, 'dto'),
    (v_rate_card_id, 'additional_1kg_5000_to_10000', 'F', 77, 'dto'),

    (v_rate_card_id, 'flat_upto_10000', 'A', 250, 'dto'),
    (v_rate_card_id, 'flat_upto_10000', 'B', 313, 'dto'),
    (v_rate_card_id, 'flat_upto_10000', 'C1', 400, 'dto'),
    (v_rate_card_id, 'flat_upto_10000', 'C2', 437, 'dto'),
    (v_rate_card_id, 'flat_upto_10000', 'D1', 447, 'dto'),
    (v_rate_card_id, 'flat_upto_10000', 'D2', 464, 'dto'),
    (v_rate_card_id, 'flat_upto_10000', 'E', 563, 'dto'),
    (v_rate_card_id, 'flat_upto_10000', 'F', 626, 'dto'),

    (v_rate_card_id, 'additional_1kg_beyond_10000', 'A', 22, 'dto'),
    (v_rate_card_id, 'additional_1kg_beyond_10000', 'B', 27, 'dto'),
    (v_rate_card_id, 'additional_1kg_beyond_10000', 'C1', 31, 'dto'),
    (v_rate_card_id, 'additional_1kg_beyond_10000', 'C2', 34, 'dto'),
    (v_rate_card_id, 'additional_1kg_beyond_10000', 'D1', 36, 'dto'),
    (v_rate_card_id, 'additional_1kg_beyond_10000', 'D2', 39, 'dto'),
    (v_rate_card_id, 'additional_1kg_beyond_10000', 'E', 54, 'dto'),
    (v_rate_card_id, 'additional_1kg_beyond_10000', 'F', 56, 'dto')
  on conflict (rate_card_id, slab_key, zone_code, rate_type) do update set price_rupees = excluded.price_rupees;
end $$;
