-- Row-level security. Single internal ops role this phase: any authenticated
-- Supabase user gets full read/write access. The backend service uses the
-- service-role key (which bypasses RLS entirely) for carrier-side writes
-- such as booking results and tracking-poller updates.

alter table clients enable row level security;
alter table carriers enable row level security;
alter table rate_cards enable row level security;
alter table rate_card_slab_prices enable row level security;
alter table zones enable row level security;
alter table metro_cities enable row level security;
alter table pincode_master enable row level security;
alter table pincode_zone_map enable row level security;
alter table shipments enable row level security;
alter table tracking_events enable row level security;
alter table client_integrations enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'carriers', 'rate_cards', 'rate_card_slab_prices', 'zones',
    'metro_cities', 'pincode_master', 'pincode_zone_map', 'shipments',
    'tracking_events', 'client_integrations'
  ]
  loop
    execute format(
      'create policy "authenticated_full_access" on %I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;
