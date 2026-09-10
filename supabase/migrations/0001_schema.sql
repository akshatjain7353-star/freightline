-- Freightline core schema
-- Run via `supabase db push` or the Supabase SQL editor, in filename order.

create extension if not exists "pgcrypto";

create type payment_mode as enum ('COD', 'Prepaid');
create type shipment_status as enum ('pending', 'in_transit', 'delivered', 'ndr', 'rto');
create type zone_source as enum ('api', 'lookup_table', 'computed');
create type integration_platform as enum ('shopify', 'unicommerce');
create type integration_auth_type as enum ('oauth', 'api_key');
create type integration_status as enum ('pending', 'connected', 'error', 'disconnected');

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Carriers + rate cards
-- ---------------------------------------------------------------------------
create table carriers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique, -- e.g. 'delhivery', 'xpressbees'
  active boolean not null default true,
  base_url_staging text,
  base_url_production text,
  use_staging boolean not null default true,
  created_at timestamptz not null default now()
);

create table rate_cards (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references carriers(id) on delete cascade,
  name text not null,
  -- Configurable, not hardcoded: currently 0 but changes over time per carrier negotiation.
  fuel_surcharge_percent numeric(6,3) not null default 0,
  effective_from date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row per (slab, zone) cell. Mirrors delhivery_rate_card.csv directly.
create table rate_card_slab_prices (
  id uuid primary key default gen_random_uuid(),
  rate_card_id uuid not null references rate_cards(id) on delete cascade,
  slab_key text not null check (slab_key in (
    'flat_0_250',
    'flat_upto_500',
    'flat_upto_5000',
    'flat_upto_10000',
    'additional_500g_500_to_5000',
    'additional_1kg_5000_to_10000',
    'additional_1kg_beyond_10000'
  )),
  zone_code text not null,
  price_rupees numeric(10,2) not null,
  unique (rate_card_id, slab_key, zone_code)
);

-- ---------------------------------------------------------------------------
-- Zones + pincode resolution data
-- ---------------------------------------------------------------------------
create table zones (
  zone_code text primary key,
  zone_type text not null
);

alter table rate_card_slab_prices
  add constraint rate_card_slab_prices_zone_code_fkey
  foreign key (zone_code) references zones(zone_code);

-- Editable metro list used by the Path 3 computed zone fallback. Not hardcoded in app code.
create table metro_cities (
  city_name text primary key
);

-- Path 3 input: pincode -> lat/lng + metro flag. Seeded with a handful of
-- verifiable major-metro pincodes only; production use needs a full bulk import.
create table pincode_master (
  pincode text primary key,
  city text not null,
  state text not null,
  lat double precision not null,
  lng double precision not null,
  is_metro boolean not null default false
);

-- Path 2 input: direct origin/destination -> zone lookup table, as Delhivery may
-- supply as a static file instead of a live API. Empty until that file exists.
create table pincode_zone_map (
  origin_pincode text not null,
  destination_pincode text not null,
  zone_code text not null references zones(zone_code),
  source text not null default 'delhivery_master_file',
  primary key (origin_pincode, destination_pincode)
);

-- ---------------------------------------------------------------------------
-- Shipments + tracking
-- ---------------------------------------------------------------------------
create table shipments (
  id uuid primary key default gen_random_uuid(),
  awb text,
  order_id text not null unique,
  client_id uuid not null references clients(id),
  carrier_id uuid not null references carriers(id),
  origin_pincode text not null,
  destination_pincode text not null,
  weight_grams numeric(10,2) not null,
  length_cm numeric(8,2) not null,
  width_cm numeric(8,2) not null,
  height_cm numeric(8,2) not null,
  chargeable_weight_grams numeric(10,2) not null,
  zone_code text references zones(zone_code),
  zone_source zone_source,
  payment_mode payment_mode not null,
  status shipment_status not null default 'pending',
  cost_rupees numeric(10,2),
  cod_charge_rupees numeric(10,2) not null default 0,
  fuel_surcharge_percent_applied numeric(6,3) not null default 0,
  shipment_value_rupees numeric(10,2),
  raw_booking_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_shipments_status on shipments(status);
create index idx_shipments_carrier on shipments(carrier_id);
create index idx_shipments_client on shipments(client_id);
create index idx_shipments_created_at on shipments(created_at);
create index idx_shipments_awb on shipments(awb);

create table tracking_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  status text not null,
  event_timestamp timestamptz not null,
  location text,
  raw_carrier_payload jsonb,
  created_at timestamptz not null default now()
);

create index idx_tracking_events_shipment on tracking_events(shipment_id);

-- ---------------------------------------------------------------------------
-- Client integrations — placeholder table only. Not wired to any flow yet;
-- exists so the schema doesn't need rework when Shopify/Unicommerce ingestion
-- is built in a later phase.
-- ---------------------------------------------------------------------------
create table client_integrations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  platform integration_platform not null,
  auth_type integration_auth_type not null,
  credentials_encrypted text,
  connected_at timestamptz,
  status integration_status not null default 'pending',
  created_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_shipments_updated_at
  before update on shipments
  for each row execute function set_updated_at();
