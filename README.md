# Freightline — Time Bound Internal Ops Console

Internal logistics console for quoting, booking, and tracking shipments.
**Phase 1 is the supported daily-ops surface.** Later billing, NDR/DTO carrier
calls, and Unicommerce pieces remain in the repo but are explicitly staged so
they cannot look like production features.

v1 carrier: Delhivery only. Order intake: Create Shipment and CSV bulk upload.
A live `DELHIVERY_API_KEY` is optional — without it the console still quotes
from the seeded rate card and saves local shipments (no AWB).

## What works today (Phase 1)

| Surface | Status |
|---|---|
| Login + roles (`admin`, `accounts_ops`, `ops_only`) | Ready — Supabase Auth + `user_roles` + RLS + backend middleware |
| Rate Calculator | Ready — live Delhivery quote when a key is set, otherwise rate-card fallback |
| Create Shipment / Bulk Upload CSV | Ready — live booking when a key is set, otherwise local save (no AWB) |
| Shipments list + detail status | Ready |
| Tracking poller | Ready **only** when `DELHIVERY_API_KEY` is set; otherwise it does not start |
| Dashboard KPIs / charts | Ready — seeded or booked shipments. Revenue hidden (`—`) for `ops_only` |
| Exceptions queue | Ready (local) |
| Vendor / client rate cards | Ready (local, versioned) |
| Weight discrepancies | Ready for **manual** vendor-weight + Accept/Dispute/Resolve. Auto flags from tracking `ChargedWeight` are unverified |

## Staged / not ready (kept, not deleted)

Admin and `accounts_ops` can open these screens. They show a **Staging / Not ready**
banner. `ops_only` does not see them in the sidebar (direct URLs show Coming soon).

**Unverified Delhivery APIs — actions disabled, backend returns HTTP 501:**

- Schedule Pickup
- View / Print Label
- NDR Request Reattempt
- Create Reverse Pickup / Initiate DTO / Approve DTO request

Local NDR actions (edit address, log contact, convert to RTO) and DTO **reject**
still work — they do not call the carrier.

**Billing / ledger — do not file or send to clients:**

- Invoices (GST is hardcoded 18% / always IGST — generate is disabled)
- Vendor reconciliation (AWB-only one-to-one matching)
- Cash reconciliation
- Carrier COD remittance (assumes one remittance line per AWB)
- Client ledger (settlement uses ledger `created_at`, not delivery date)
- Unicommerce credentials (local issue works; shipper manifest is not implemented)

`GET /api/capabilities` (auth required) returns the same catalog plus whether
Delhivery is configured.

## Repo layout

- `supabase/` — SQL migrations (`migrations/0001`–`0023`) and `seed.sql`
- `backend/` — Express/TypeScript: Delhivery adapter, rate engine, booking, poller
- `frontend/` — React/Vite ops console
- `reference-data/` — Delhivery rate card and zone matrix CSVs this build was generated from

## One-time setup

### 1. Supabase project

1. Create a Supabase project.
2. Run **all** migrations in filename order (`0001_schema.sql` through `0023_refresh_rate_card_views.sql`). `0006_add_dto_status.sql` must commit before `0007_shipment_schema_fixes.sql` (Postgres requires a new enum value to be committed before it is usable). If the SQL editor is awkward, `supabase/manual-apply/` has batched files.
3. Run `supabase/seed.sql` **after** the migrations. It loads:
   - Delhivery carrier, rate card, zones, metro list, ~18 metro pincodes
   - **Test Client** (`00000000-0000-0000-0000-000000000201`)
   - Five Phase 1 sample shipments (pending / in transit / delivered / NDR / RTO) plus tracking events — enough to click Dashboard and Shipments **without** a Delhivery key
4. Create at least one Supabase Auth user (email/password) — Authentication → Users → Add user.
5. Assign a role (there is no manage-users UI yet):

   ```sql
   insert into user_roles (user_id, role) values ('<auth-user-uuid>', 'admin');
   -- role is one of: 'admin', 'accounts_ops', 'ops_only'
   ```

   A user with no `user_roles` row can sign in; the dashboard explains that pricing/admin stay blocked until a role is assigned.
6. Create Shipment / Bulk Upload already have **Test Client**. Bulk Upload has a sample CSV (`frontend/public/sample-bulk-upload.csv`) that uses that client UUID and `110001` → `400001`.
7. Optional larger demo (70 shipments, invoices, remittance): `cd backend && npm run seed:demo` after backend `.env` is set. Invoice generate stays disabled in the UI; the script writes drafts via the service layer for admin inspection only.

### 2. Node.js

Node 18+ (LTS). In `backend/` and `frontend/`:

```bash
npm install
```

### 3. Environment variables

Copy `.env.example` to `.env` in both `backend/` and `frontend/`.

**backend/.env**

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — required.
- `DELHIVERY_API_KEY` — optional. Leave blank for Phase 1 local use. Do not invent a token.
- `DELHIVERY_ENV` — `staging` until you are ready to book real shipments.
- `DELHIVERY_ZONE_API_PATH` — leave blank until a live zone-classification API is confirmed.
- `TRACKING_POLL_INTERVAL_MINUTES` — used only when a Delhivery key is set.
- `CORS_ORIGINS` — frontend URL(s), comma-separated.

**frontend/.env**

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_BACKEND_URL` — `http://localhost:8080` locally

### 4. Run locally

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

Frontend: `http://localhost:5173`. Backend: `http://localhost:8080`.

Offline checks (no live Supabase/Delhivery credentials):

```bash
cd backend && npm test && npm run typecheck
cd frontend && npm run typecheck
```

### 5. Deploy to Railway

Two Railway services from this repo (`backend/` and `frontend/`). Set the same
env vars as above, plus `PORT` if Railway does not inject it. Frontend `npm start`
is a Vite preview server.

## Manual test checklist (Phase 1 golden path)

Needs a real Supabase project. Delhivery key is optional (steps note the difference).

1. Sign in at `/login` as `admin`.
2. **Rate Calculator**: quote `110001` → `400001` (seeded, same metro). Confirm a zone and a total. Label should say `live API quote` if a key is set, otherwise `fallback rate card`.
3. Quote a pincode that is not in `pincode_master` — expect a clear "pincode not mapped" error, not a wrong zone.
4. **Create Shipment**: book for a seeded client on a seeded pincode pair. Confirm it appears in **Shipments** with a status pill, zone, and cost. With a Delhivery key, destination pincode should show a serviceable badge; without a key, the badge says serviceability was not checked.
5. **Bulk Upload**: download the sample CSV on the page, map columns, upload — per-row success/failure matches Shipments.
6. **Dashboard**: after `seed.sql`, KPI cards are non-empty. `ops_only` sees Revenue as `—`.
7. Toggle dark/light mode and confirm it persists across reload.

### RBAC

8. Assign `accounts_ops` and `ops_only` users via `user_roles`.
9. `ops_only`: no Rate Calculator / Rate Cards / Invoices / Vendor Reconciliation / NDR / DTO / Reverse Pickup / billing items in the sidebar. Direct URLs to gated screens show Coming soon. Shipments Cost and Dashboard Revenue show `—`. Create Shipment and Bulk Upload still work.
10. `accounts_ops`: Rate Cards and staged billing screens are visible with banners. No user-management UI (expected).

### Staged screens (admin)

11. Shipment detail: Schedule Pickup, View/Print Label, and Initiate DTO are disabled with an honest reason. DTO is only offered after `delivered` (and still disabled until the reverse-pickup API is verified).
12. NDR Queue: Request Reattempt is disabled; Edit Address / Contact / Convert to RTO still work on an `ndr` shipment.
13. Invoices: Generate is disabled. Do not treat listed totals as filing-ready.

## Placeholder / needs real data

- **Zone Path 1** (live Delhivery zone API): only if `DELHIVERY_ZONE_API_PATH` is set. Leave blank.
- **Zone Path 2** (`pincode_zone_map`): empty until Delhivery supplies a static master file.
- **`pincode_master`**: ~18 seeded metros. Other pincodes fail with "pincode not mapped".
- **Delhivery rate API `ss` param**: omitted on purpose; undocumented for pre-shipment quotes.
- **Xpressbees / Ekart**: no adapters yet. Same `CarrierAdapter` interface.
- **Shopify / Unicommerce order ingestion**: `client_integrations` exists; no OAuth flow. Unicommerce shipper is incomplete.
- **Pickup / label / reverse-pickup / NDR reattempt adapters**: endpoint paths and shapes are unconfirmed. Code is quarantined behind 501 — do not guess production contracts.
- **Tracking `ChargedWeight`**: field name is a guess. Use `PATCH /api/shipments/:id/vendor-weight` until confirmed.
- **GST**: 18% and always-IGST. Invoice number `INV/<year>/<seq>` is a placeholder.
- **Client rate cards**: empty until published; bookings then get `client_billed_amount = null`.

## Rate engine reference

Fallback pricing in `backend/src/rate-engine/rate-card-calculator.ts` matches
`reference-data/delhivery_rate_card.csv`:

| Band | Pricing |
|---|---|
| 0–250g | flat `DL 0-250 gm` |
| 250–500g | flat `DL Upto 500 gm` |
| 500g–5kg | round up to next 500g; 500g flat + additional-500g-slab × increments |
| 5kg–10kg | round up to next 1kg; 5kg flat + additional-1kg-slab(5-10kg) × kg over 5 |
| >10kg | round up to next 1kg; 10kg flat + additional-1kg-slab(beyond 10kg) × kg over 10 |

Fuel surcharge (`rate_cards.fuel_surcharge_percent`) is a percentage on top. COD
charge is `max(cod_charge_percent of shipment value, cod_charge_minimum_rupees)`
from the current rate card. RTO uses the same forward rate card.
