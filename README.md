# Freightline — Time Bound Internal Ops Console

Internal logistics ops console: create/track shipments across carriers, calculate
rates before booking, and monitor delivery performance. v1 ships with Delhivery
as the only live carrier; manual entry and CSV bulk upload are the only order
intake paths this phase.

## Repo layout

- `supabase/` — SQL migrations (`migrations/`) and seed data (`seed.sql`) for the Postgres schema.
- `backend/` — Node/TypeScript service (Express) hosted on Railway: Delhivery adapter, rate engine, booking, bulk upload, tracking poller.
- `frontend/` — React/Vite/TypeScript ops console, hosted on Railway.
- `reference-data/` — the Delhivery rate card and zone matrix CSVs this build was generated from.

## One-time setup

### 1. Supabase project

1. Create a Supabase project.
2. Run the migrations in order against it (SQL editor, or `supabase db push` with the Supabase CLI once installed):
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_dashboard_views.sql`
3. Run `supabase/seed.sql` to load the Delhivery carrier, rate card, zones, metro list, and the small pincode seed set.
4. Create at least one Supabase Auth user (email/password) for ops team login — Authentication → Users → Add user in the Supabase dashboard.
5. Add at least one row to `clients` (via SQL editor or later a small admin flow) so Create Shipment / Bulk Upload have a client to select.

### 2. Node.js and git

Already installed on this machine (Node v24 LTS, git). Both `backend/` and `frontend/` have had `npm install` run and type-check/build clean. If setting up on a different machine:

```bash
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

Then from a new terminal, in both `backend/` and `frontend/`:

```bash
npm install
```

### 3. Environment variables

Copy `.env.example` to `.env` in both `backend/` and `frontend/`, and fill in:

**backend/.env**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings → API.
- `DELHIVERY_API_KEY` — your Delhivery token.
- `DELHIVERY_ENV` — `staging` until you're ready to book real shipments, then `production`.
- `DELHIVERY_ZONE_API_PATH` — leave blank. See "Placeholder / needs real data" below.
- `DEFAULT_FUEL_SURCHARGE_PERCENT` — `0` today; change here (not in code) when Delhivery's fuel surcharge changes.
- `TRACKING_POLL_INTERVAL_MINUTES` — how often the tracking poller runs.
- `CORS_ORIGINS` — the frontend's URL(s), comma-separated.

**frontend/.env**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — from Supabase project settings → API.
- `VITE_BACKEND_URL` — the backend's URL (`http://localhost:8080` locally).

### 4. Run locally

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

Frontend runs at `http://localhost:5173`, backend at `http://localhost:8080`.

### 5. Deploy to Railway

Create two Railway services from this repo, one rooted at `backend/` and one at `frontend/`. Railway auto-detects Node via `package.json` (`npm run build` then `npm start` for the backend; `npm run build` then `npm start` — a Vite preview server — for the frontend). Set the same environment variables as above in each service's Railway settings, plus `PORT` if Railway doesn't inject it automatically for the frontend preview server.

## Manual test checklist (do this after Supabase/Delhivery setup — the code itself already builds and type-checks, but hasn't been run against live data yet)

1. Sign in at `/login` with the Supabase Auth user you created.
2. **Rate Calculator**: quote `110001` → `400001` (both seeded, same-metro-list, real distance) — confirm a quote returns with a zone and a total cost, and check whether it came from the live API or the fallback rate card.
3. Quote a pincode pair where one side isn't in `pincode_master` (anything outside the ~18 seeded pincodes) — confirm you get a clear "pincode not mapped" error, not a wrong zone.
4. **Create Shipment**: book a shipment for a seeded client using one of the seeded pincode pairs — confirm it appears in **Shipments** with a status pill, zone, and cost.
5. **Bulk Upload**: upload a small CSV using the column list shown on the page — confirm the per-row success/failure report matches what landed in Shipments.
6. **Dashboard**: confirm the KPI cards and both charts show non-empty data reflecting the shipments you just created.
7. Toggle dark/light mode and confirm it persists across a page reload.

## Placeholder / needs real data before this is fully production-ready

- **Zone resolution Path 1** (live Delhivery zone-classification API): unconfirmed whether Delhivery exposes one. `zone-resolver.ts` calls it only if `DELHIVERY_ZONE_API_PATH` is set — leave blank until validated against sandbox.
- **Zone resolution Path 2** (`pincode_zone_map` table): empty until Delhivery supplies a static pincode-to-zone master file. Loading it is a data import, not a code change.
- **`pincode_master` beyond the ~18 seeded metro pincodes**: Path 3 (the computed distance/metro fallback) throws a "pincode not mapped" error for anything not in this table. Import a full pincode → lat/lng dataset (e.g. an India Post pincode directory) to cover arbitrary shipments.
- **Delhivery rate API's `ss` param**: deliberately omitted from the request in `rate.ts` — its purpose for a pre-shipment quote is undocumented. Verify against sandbox before adding it.
- **Xpressbees and Ekart**: no adapters built yet. Both plug into the same `CarrierAdapter` interface (`backend/src/lib/types.ts`) that Delhivery implements — see `backend/src/adapters/delhivery/` as the reference implementation.
- **Shopify/Unicommerce order ingestion**: `client_integrations` table exists in the schema but no OAuth/API-key connection flow is wired up, per spec — this is intentionally deferred.
- **E/F zone destination lists** (North-East/Jammu/HP/Uttarakhand → E; Leh Ladakh/Andaman Nicobar/Manipur/Kashmir → F): implemented as a best-effort state/city match in `zone-resolver.ts` since the spec mixes states and sub-state regions (e.g. splitting Jammu from Kashmir, both part of Jammu & Kashmir). Review `ZONE_E_STATES`/`ZONE_F_STATES` against real Delhivery classifications.

## Rate engine reference

The fallback (manual rate-card) pricing in `backend/src/rate-engine/rate-card-calculator.ts` implements exactly the bands in `reference-data/delhivery_rate_card.csv`:

| Band | Pricing |
|---|---|
| 0–250g | flat `DL 0-250 gm` |
| 250–500g | flat `DL Upto 500 gm` |
| 500g–5kg | round up to next 500g; 500g flat + additional-500g-slab × increments |
| 5kg–10kg | round up to next 1kg; 5kg flat + additional-1kg-slab(5-10kg) × kg over 5 |
| >10kg | round up to next 1kg; 10kg flat + additional-1kg-slab(beyond 10kg) × kg over 10 |

Fuel surcharge (`rate_cards.fuel_surcharge_percent`, currently 0) is applied as a percentage on top. COD charge is `max(1% of shipment value, ₹20)`, added separately. RTO uses the same rate card as forward shipments.
