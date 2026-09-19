-- Seed data: Delhivery carrier + rate card (from reference-data/delhivery_rate_card.csv),
-- zones (from reference-data/delhivery_zone_matrix.csv), a starter metro list, and a
-- small set of real, verifiable metro pincodes for the Path 3 zone-resolution fallback.
--
-- Run after the migrations in supabase/migrations/.

-- ---------------------------------------------------------------------------
-- Zones (delhivery_zone_matrix.csv)
-- ---------------------------------------------------------------------------
insert into zones (zone_code, zone_type) values
  ('A', 'Within City/Same city'),
  ('B', 'upto 500 KM Regional (Single connection)'),
  ('C1', 'Metro to Metro (501 KM - 1400 KM)'),
  ('C2', 'Metro to Metro (1401 KM - 2500 KM)'),
  ('D1', 'Rest of India (501 KM - 1400 KM)'),
  ('D2', 'Rest of India (1401 KM - 2500 KM)'),
  ('E', 'North-East, Jammu, HP, UK'),
  ('F', 'Leh Ladakh, Andaman Nicobar, Manipur, Kashmir')
on conflict (zone_code) do nothing;

-- ---------------------------------------------------------------------------
-- Carrier + rate card
-- ---------------------------------------------------------------------------
insert into carriers (id, name, code, active, base_url_staging, base_url_production, use_staging)
values (
  '00000000-0000-0000-0000-000000000001',
  'Delhivery',
  'delhivery',
  true,
  'https://staging-express.delhivery.com',
  'https://track.delhivery.com',
  true
)
on conflict (code) do nothing;

insert into rate_cards (id, carrier_id, name, fuel_surcharge_percent, active)
values (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'Delhivery Standard',
  0, -- fuel surcharge is 0 today; kept configurable per spec, change here as it moves.
  true
)
on conflict do nothing;

-- delhivery_rate_card.csv, one row per (slab, zone) cell.
-- slab_upper_bound_grams,slab_label,zone_a,zone_b,zone_c1,zone_c2,zone_d1,zone_d2,zone_e,zone_f
-- 250,DL 0-250 gm,25,29,29,30,31,32,39,43
-- 500,DL Upto 500 gm (flat),29,33,36,38,38,40,48,53
-- 5000,DL Upto 5 kg (flat),90,125,160,175,178,185,224,249
-- 10000,DL Upto 10 kg (flat),147,184,235,257,263,273,331,368
-- ,DL Additional 500gm slab (500g-5kg band, per 500g over 500g),7,12,16,21,21,24,29,32
-- ,DL Additional 1kg slab (5kg-10kg band, per 1kg over 5kg),19,21,25,27,29,32,38,45
-- ,DL Additional 1kg slab (beyond 10kg, per 1kg over 10kg),13,16,18,20,21,23,32,33
insert into rate_card_slab_prices (rate_card_id, slab_key, zone_code, price_rupees)
values
  ('00000000-0000-0000-0000-000000000101', 'flat_0_250', 'A', 25),
  ('00000000-0000-0000-0000-000000000101', 'flat_0_250', 'B', 29),
  ('00000000-0000-0000-0000-000000000101', 'flat_0_250', 'C1', 29),
  ('00000000-0000-0000-0000-000000000101', 'flat_0_250', 'C2', 30),
  ('00000000-0000-0000-0000-000000000101', 'flat_0_250', 'D1', 31),
  ('00000000-0000-0000-0000-000000000101', 'flat_0_250', 'D2', 32),
  ('00000000-0000-0000-0000-000000000101', 'flat_0_250', 'E', 39),
  ('00000000-0000-0000-0000-000000000101', 'flat_0_250', 'F', 43),

  ('00000000-0000-0000-0000-000000000101', 'flat_upto_500', 'A', 29),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_500', 'B', 33),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_500', 'C1', 36),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_500', 'C2', 38),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_500', 'D1', 38),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_500', 'D2', 40),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_500', 'E', 48),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_500', 'F', 53),

  ('00000000-0000-0000-0000-000000000101', 'flat_upto_5000', 'A', 90),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_5000', 'B', 125),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_5000', 'C1', 160),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_5000', 'C2', 175),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_5000', 'D1', 178),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_5000', 'D2', 185),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_5000', 'E', 224),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_5000', 'F', 249),

  ('00000000-0000-0000-0000-000000000101', 'flat_upto_10000', 'A', 147),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_10000', 'B', 184),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_10000', 'C1', 235),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_10000', 'C2', 257),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_10000', 'D1', 263),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_10000', 'D2', 273),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_10000', 'E', 331),
  ('00000000-0000-0000-0000-000000000101', 'flat_upto_10000', 'F', 368),

  ('00000000-0000-0000-0000-000000000101', 'additional_500g_500_to_5000', 'A', 7),
  ('00000000-0000-0000-0000-000000000101', 'additional_500g_500_to_5000', 'B', 12),
  ('00000000-0000-0000-0000-000000000101', 'additional_500g_500_to_5000', 'C1', 16),
  ('00000000-0000-0000-0000-000000000101', 'additional_500g_500_to_5000', 'C2', 21),
  ('00000000-0000-0000-0000-000000000101', 'additional_500g_500_to_5000', 'D1', 21),
  ('00000000-0000-0000-0000-000000000101', 'additional_500g_500_to_5000', 'D2', 24),
  ('00000000-0000-0000-0000-000000000101', 'additional_500g_500_to_5000', 'E', 29),
  ('00000000-0000-0000-0000-000000000101', 'additional_500g_500_to_5000', 'F', 32),

  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_5000_to_10000', 'A', 19),
  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_5000_to_10000', 'B', 21),
  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_5000_to_10000', 'C1', 25),
  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_5000_to_10000', 'C2', 27),
  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_5000_to_10000', 'D1', 29),
  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_5000_to_10000', 'D2', 32),
  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_5000_to_10000', 'E', 38),
  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_5000_to_10000', 'F', 45),

  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_beyond_10000', 'A', 13),
  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_beyond_10000', 'B', 16),
  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_beyond_10000', 'C1', 18),
  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_beyond_10000', 'C2', 20),
  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_beyond_10000', 'D1', 21),
  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_beyond_10000', 'D2', 23),
  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_beyond_10000', 'E', 32),
  ('00000000-0000-0000-0000-000000000101', 'additional_1kg_beyond_10000', 'F', 33)
on conflict (rate_card_id, slab_key, zone_code) do update set price_rupees = excluded.price_rupees;

-- ---------------------------------------------------------------------------
-- Metro city list (editable; used by the Path 3 computed zone fallback).
-- Standard commonly-used Indian courier "metro" set.
-- ---------------------------------------------------------------------------
insert into metro_cities (city_name) values
  ('Delhi'), ('Mumbai'), ('Bangalore'), ('Chennai'), ('Kolkata'),
  ('Hyderabad'), ('Pune'), ('Ahmedabad')
on conflict (city_name) do nothing;

-- ---------------------------------------------------------------------------
-- Pincode master — SEED DATA ONLY. Covers a handful of real, publicly-known
-- metro-area pincodes so the Path 3 zone-resolution code path is exercisable
-- end to end. This is NOT a full pincode dataset — resolveZone() throws a
-- "pincode not mapped" error for anything not listed here. Import a real
-- bulk pincode -> lat/lng dataset into this table before relying on Path 3
-- for arbitrary shipments.
-- ---------------------------------------------------------------------------
insert into pincode_master (pincode, city, state, lat, lng, is_metro) values
  ('110001', 'Delhi', 'Delhi', 28.6339, 77.2197, true),
  ('110037', 'Delhi', 'Delhi', 28.5493, 77.0910, true),
  ('400001', 'Mumbai', 'Maharashtra', 18.9388, 72.8354, true),
  ('400069', 'Mumbai', 'Maharashtra', 19.1075, 72.8263, true),
  ('560001', 'Bangalore', 'Karnataka', 12.9767, 77.5713, true),
  ('560103', 'Bangalore', 'Karnataka', 12.9141, 77.6411, true),
  ('600001', 'Chennai', 'Tamil Nadu', 13.0940, 80.2836, true),
  ('600089', 'Chennai', 'Tamil Nadu', 13.0206, 80.2437, true),
  ('700001', 'Kolkata', 'West Bengal', 22.5726, 88.3639, true),
  ('700091', 'Kolkata', 'West Bengal', 22.5697, 88.4200, true),
  ('500001', 'Hyderabad', 'Telangana', 17.3871, 78.4739, true),
  ('500081', 'Hyderabad', 'Telangana', 17.4435, 78.3772, true),
  ('411001', 'Pune', 'Maharashtra', 18.5196, 73.8553, true),
  ('411057', 'Pune', 'Maharashtra', 18.5679, 73.7143, true),
  ('380001', 'Ahmedabad', 'Gujarat', 23.0225, 72.5714, true),
  ('382481', 'Ahmedabad', 'Gujarat', 23.0037, 72.5148, true),
  ('302001', 'Jaipur', 'Rajasthan', 26.9124, 75.7873, false),
  ('226001', 'Lucknow', 'Uttar Pradesh', 26.8467, 80.9462, false)
on conflict (pincode) do nothing;

-- ---------------------------------------------------------------------------
-- Phase 1 click-through data (no Delhivery calls). Safe to re-run.
-- After Auth users exist, assign roles separately — this only adds a client
-- and a handful of shipments so Dashboard / Shipments / Create Shipment work.
-- ---------------------------------------------------------------------------
insert into clients (id, name, contact_info, is_seed_data)
values (
  '00000000-0000-0000-0000-000000000201',
  'Test Client',
  '{"email":"ops@example.com"}'::jsonb,
  true
)
on conflict (id) do nothing;

insert into shipments (
  id, awb, order_id, client_id, carrier_id,
  origin_pincode, destination_pincode, destination_address_line, destination_city,
  weight_grams, length_cm, width_cm, height_cm, chargeable_weight_grams,
  zone_code, zone_source, payment_mode, status,
  rate_card_id, cost_rupees, cod_charge_rupees, shipment_value_rupees,
  source, is_seed_data, raw_booking_response
) values
  (
    '00000000-0000-0000-0000-000000000301',
    null,
    'PHASE1-PENDING-001',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000001',
    '110001', '400001', '12 Connaught Place', 'Delhi',
    1000, 10, 10, 10, 1000,
    'C1', 'computed', 'Prepaid', 'pending',
    '00000000-0000-0000-0000-000000000101', 52, 0, 500,
    'manual', true, '{"mode":"local_offline","seed":"phase1"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    'PHASE1-AWB-INTRANSIT',
    'PHASE1-INTRANSIT-001',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000001',
    '400001', '400069', '8 Fort Market', 'Mumbai',
    800, 12, 10, 8, 800,
    'A', 'computed', 'COD', 'in_transit',
    '00000000-0000-0000-0000-000000000101', 36, 20, 1200,
    'manual', true, '{"mode":"local_offline","seed":"phase1"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    'PHASE1-AWB-DELIVERED',
    'PHASE1-DELIVERED-001',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000001',
    '110001', '110037', '4 IGI Cargo', 'Delhi',
    400, 10, 10, 10, 400,
    'A', 'computed', 'Prepaid', 'delivered',
    '00000000-0000-0000-0000-000000000101', 29, 0, 800,
    'manual', true, '{"mode":"local_offline","seed":"phase1"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000304',
    'PHASE1-AWB-NDR',
    'PHASE1-NDR-001',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000001',
    '560001', '560103', '22 MG Road', 'Bangalore',
    1500, 15, 12, 10, 1500,
    'A', 'computed', 'COD', 'ndr',
    '00000000-0000-0000-0000-000000000101', 43, 20, 900,
    'manual', true, '{"mode":"local_offline","seed":"phase1"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000305',
    'PHASE1-AWB-RTO',
    'PHASE1-RTO-001',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000001',
    '600001', '600089', '9 T Nagar', 'Chennai',
    600, 10, 10, 10, 600,
    'A', 'computed', 'Prepaid', 'rto',
    '00000000-0000-0000-0000-000000000101', 36, 0, 400,
    'manual', true, '{"mode":"local_offline","seed":"phase1"}'::jsonb
  )
on conflict (id) do nothing;

insert into tracking_events (shipment_id, status, event_timestamp, location, raw_carrier_payload)
select v.shipment_id, v.status, now() - v.hours_ago * interval '1 hour', v.location, '{"seed":"phase1"}'::jsonb
from (values
  ('00000000-0000-0000-0000-000000000301'::uuid, 'Booked', 6, 'Origin hub'),
  ('00000000-0000-0000-0000-000000000302'::uuid, 'Booked', 36, 'Origin hub'),
  ('00000000-0000-0000-0000-000000000302'::uuid, 'Picked Up', 24, 'Origin hub'),
  ('00000000-0000-0000-0000-000000000302'::uuid, 'In Transit', 8, 'Transit hub'),
  ('00000000-0000-0000-0000-000000000303'::uuid, 'Booked', 72, 'Origin hub'),
  ('00000000-0000-0000-0000-000000000303'::uuid, 'Picked Up', 60, 'Origin hub'),
  ('00000000-0000-0000-0000-000000000303'::uuid, 'Delivered', 12, 'Destination'),
  ('00000000-0000-0000-0000-000000000304'::uuid, 'Booked', 48, 'Origin hub'),
  ('00000000-0000-0000-0000-000000000304'::uuid, 'Undelivered - NDR', 6, 'Destination hub'),
  ('00000000-0000-0000-0000-000000000305'::uuid, 'Booked', 96, 'Origin hub'),
  ('00000000-0000-0000-0000-000000000305'::uuid, 'RTO Initiated', 24, 'Destination hub')
) as v(shipment_id, status, hours_ago, location)
where exists (select 1 from shipments s where s.id = v.shipment_id)
  and not exists (
    select 1 from tracking_events te
    where te.shipment_id = v.shipment_id and te.status = v.status
  );

