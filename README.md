# Freightline — Time Bound Internal Ops Console

Internal logistics ops console: create/track shipments across carriers, calculate
rates before booking, and monitor delivery performance. v1 ships with Delhivery
as the only live carrier; manual entry and CSV bulk upload are the only order
intake paths this phase.

Three internal roles are enforced end to end (Postgres RLS + backend middleware
+ frontend gating) — **Admin** (full access), **Accounts & Operations** (full
operational access plus rate-card/pricing access), and **Operations-only** (new
orders, tracking, dashboard — no pricing access anywhere: cost/margin/revenue
are masked to null, and the Rate Calculator and rate-card/invoice/vendor-
reconciliation screens are blocked outright). Beyond Phase 1, this build also
covers rate-card versioning with a full audit trail, DTO returns (booked as a
linked shipment with its own AWB), weight-discrepancy flagging, a real NDR
workflow, pickup scheduling & label generation, a system-exceptions queue,
GST invoice generation with vendor-invoice reconciliation, client rate cards
(the sell-side mirror of vendor rate cards), per-order cash reconciliation,
carrier COD remittance matching, and the client ledger — a per-client
running balance of freight owed vs. COD collected, netted per-period for
"netted" clients or tracked as two separate balances for "separate" clients.

## Repo layout

- `supabase/` — SQL migrations (`migrations/`) and seed data (`seed.sql`) for the Postgres schema.
- `backend/` — Node/TypeScript service (Express) hosted on Railway: Delhivery adapter, rate engine, booking, bulk upload, tracking poller.
- `frontend/` — React/Vite/TypeScript ops console, hosted on Railway.
- `reference-data/` — the Delhivery rate card and zone matrix CSVs this build was generated from.

## One-time setup

### 1. Supabase project

1. Create a Supabase project.
2. Run the migrations in order against it (SQL editor, or `supabase db push` with the Supabase CLI once installed) — `supabase/migrations/0001_schema.sql` through `0015_client_ledger.sql`, in filename order. `0006_add_dto_status.sql` must commit before anything in `0007_shipment_schema_fixes.sql` runs (Postgres requires a new enum value to be committed before it's usable) — run them as separate statements/batches if your tooling doesn't already do this per file.
3. Run `supabase/seed.sql` to load the Delhivery carrier, rate card, zones, metro list, and the small pincode seed set.
4. Create at least one Supabase Auth user (email/password) for ops team login — Authentication → Users → Add user in the Supabase dashboard.
5. Assign each user a role by inserting into `user_roles` (SQL editor — there's no "manage users" UI yet):
   ```sql
   insert into user_roles (user_id, role) values ('<auth-user-uuid>', 'admin');
   -- role is one of: 'admin', 'accounts_ops', 'ops_only'
   ```
   A user with no `user_roles` row can sign in but every role-gated screen and route treats them as having no access.
6. Add at least one row to `clients` (via SQL editor or later a small admin flow) so Create Shipment / Bulk Upload have a client to select.

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

### Phase 1 golden path

1. Sign in at `/login` with an `admin`-role Supabase Auth user.
2. **Rate Calculator**: quote `110001` → `400001` (both seeded, same-metro-list, real distance) — confirm a quote returns with a zone and a total cost, and check whether it came from the live API or the fallback rate card.
3. Quote a pincode pair where one side isn't in `pincode_master` (anything outside the ~18 seeded pincodes) — confirm you get a clear "pincode not mapped" error, not a wrong zone.
4. **Create Shipment**: book a shipment for a seeded client using one of the seeded pincode pairs — confirm it appears in **Shipments** with a status pill, zone, and cost. Confirm the destination pincode field shows a serviceable/non-serviceable badge before you submit.
5. **Bulk Upload**: upload a small CSV using the column list shown on the page — confirm the per-row success/failure report matches what landed in Shipments, and that any non-serviceable destination pincodes are flagged in a warning banner before you upload.
6. **Dashboard**: confirm the KPI cards and both charts show non-empty data reflecting the shipments you just created.
7. Toggle dark/light mode and confirm it persists across a page reload.

### RBAC

8. Create two more Supabase Auth users, assign one `accounts_ops` and one `ops_only` via `user_roles`.
9. Sign in as `ops_only` — confirm: no "Rate Calculator", "Rate Cards", "Invoices", or "Vendor Reconciliation" items in the sidebar (and navigating to their URLs directly redirects away); the Shipments table's Cost column and the Dashboard's Revenue KPI/chart show as hidden (—), not zero; Create Shipment and Bulk Upload still work.
10. Sign in as `accounts_ops` — confirm full access to Rate Cards/Invoices/Vendor Reconciliation, but no way to assign roles (no user-management UI exists yet — expected).

### Phase 1.5

11. **Rate Cards** (admin/accounts_ops): publish a new version with a changed fuel surcharge — confirm the old version now shows an `effective_to` date and "Historical", the new one shows "Current", and a fresh Rate Calculator quote uses the new fuel surcharge.
12. **Weight Discrepancies**: manually set a shipment's `vendor_charged_weight` (SQL editor, until the tracking-poller's live field is confirmed against sandbox — see below) to something >10% off its `chargeable_weight_grams` — confirm it appears in the Weight Discrepancies queue with the correct delta, and that Accept/Dispute/Resolve actions work.
13. **Shipment Detail** (`/shipments/:id`, click any row in Shipments): try Schedule Pickup and View/Print Label against Delhivery staging — expect these to fail until the pickup/label endpoint paths are confirmed (see Placeholder section). For a `delivered` shipment, confirm the "Initiate Return (DTO)" action is offered.
14. **NDR Queue**: move a shipment to `ndr` status (SQL editor, or via a real NDR tracking event) — confirm it appears in the queue with "Attempt 0 of 3 (Delhivery)", and that Edit Address / Contact Customer / Convert to RTO all work (Request Reattempt will fail until the NDR endpoint path is confirmed against sandbox).
15. **Exceptions**: trigger a booking failure (e.g. an invalid carrier code) — confirm it lands in the Exceptions queue with an open badge count in the sidebar, and that Resolve clears it.
16. **Invoices** (admin/accounts_ops): generate an invoice for a client with priced shipments in range — confirm a sequential `invoice_number`, and subtotal/tax/total add up.
17. **Vendor Reconciliation**: upload a CSV of `awb,vendorBilledAmountRupees` rows including at least one seeded shipment's AWB — confirm matched/discrepancy/unmatched counts and per-line detail render correctly.

### Phase 2

18. **Client Rate Cards** (admin/accounts_ops, `/admin/client-rate-cards`): publish a version for a seeded client — confirm a shipment booked for that client afterward gets a non-null `client_billed_amount` in **Cash Reconciliation**, while a client with no rate card still books fine with `client_billed_amount` showing as "—".
19. **Cash Reconciliation**: confirm client-charged / vendor-paid / margin columns render side by side, and that toggling a COD shipment's collection status (pending → collected → remitted) works and is audit-logged.
20. **Carrier COD Remittance** (admin/accounts_ops): upload a CSV of `awb,remittedAmountRupees` for a COD shipment's AWB — confirm the shipment's COD status flips to "collected" and a `cod_credit` entry appears on that client's ledger.
21. **Invoices**: generate an invoice for a client with a published rate card — confirm the amount now matches `client_billed_amount` (not vendor `cost_rupees`), and a `freight_debit` entry appears on the client's ledger.
22. **Client Ledger** (admin/accounts_ops, `/admin/client-ledger`): record a payment and confirm a `freight_credit` entry + updated balance; for a `netted` client, run **Settle Period** over a range covering both a `freight_debit` and a `cod_credit` entry and confirm the net amount/direction is right; for a `separate` client, use **Remit COD** and confirm the COD balance drops independently of the freight balance. Confirm **Export to Excel** downloads a working `.xlsx` for both the cross-client summary and a single client's ledger.

## Placeholder / needs real data before this is fully production-ready

- **Zone resolution Path 1** (live Delhivery zone-classification API): unconfirmed whether Delhivery exposes one. `zone-resolver.ts` calls it only if `DELHIVERY_ZONE_API_PATH` is set — leave blank until validated against sandbox.
- **Zone resolution Path 2** (`pincode_zone_map` table): empty until Delhivery supplies a static pincode-to-zone master file. Loading it is a data import, not a code change.
- **`pincode_master` beyond the ~18 seeded metro pincodes**: Path 3 (the computed distance/metro fallback) throws a "pincode not mapped" error for anything not in this table. Import a full pincode → lat/lng dataset (e.g. an India Post pincode directory) to cover arbitrary shipments.
- **Delhivery rate API's `ss` param**: deliberately omitted from the request in `rate.ts` — its purpose for a pre-shipment quote is undocumented. Verify against sandbox before adding it.
- **Xpressbees and Ekart**: no adapters built yet. Both plug into the same `CarrierAdapter` interface (`backend/src/lib/types.ts`) that Delhivery implements — see `backend/src/adapters/delhivery/` as the reference implementation.
- **Shopify/Unicommerce order ingestion**: `client_integrations` table exists in the schema but no OAuth/API-key connection flow is wired up, per spec — this is intentionally deferred.
- **E/F zone destination lists** (North-East/Jammu/HP/Uttarakhand → E; Leh Ladakh/Andaman Nicobar/Manipur/Kashmir → F): implemented as a best-effort state/city match in `zone-resolver.ts` since the spec mixes states and sub-state regions (e.g. splitting Jammu from Kashmir, both part of Jammu & Kashmir). Review `ZONE_E_STATES`/`ZONE_F_STATES` against real Delhivery classifications.
- **Pickup Request, Generate Shipping Label, reverse-pickup booking, and NDR reattempt APIs** (`backend/src/adapters/delhivery/{pickup,label,reverse-pickup,ndr}.ts`): endpoint paths, request params, and response shapes are all unconfirmed against real Delhivery docs/sandbox — same caution already applied to the zone API and the rate API's `ss` param. Verify each before relying on Schedule Pickup, View/Print Label, Initiate DTO, or NDR Request Reattempt for real shipments.
- **Vendor-reweighed weight in tracking payloads** (`backend/src/adapters/delhivery/tracking.ts`): the field name used to read a carrier-reported charged weight (`ChargedWeight`/`charged_weight`) is a guess — confirm the real field against a live tracking response before trusting automatic weight-discrepancy flags. Until then, use the manual `PATCH /api/shipments/:id/vendor-weight` entry point.
- **GST tax-split logic** (`backend/src/services/invoice-service.ts`): every invoice line defaults to IGST because Time Bound's own origin state isn't captured anywhere in the schema yet (`clients.billing_state` captures the *client's* state only). Add wherever Time Bound's registered state actually lives and switch to CGST+SGST for intra-state clients before invoices go out for real. The 18% GST rate is also a placeholder — confirm against the applicable rate for logistics services.
- **Invoice number format** (`next_invoice_number()` in `0011_gst_invoicing.sql`): `INV/<year>/<seq>` is a placeholder. Sequential and unique-per-financial-year is the only hard legal requirement — confirm the actual format with whoever handles Time Bound's GST filing.
- **DTO reverse-pickup pricing**: booked as Prepaid with no COD charge, matching the "return to origin, no cash collected on a return" assumption — revisit if Delhivery's reverse-pickup billing works differently in practice.
- **Client rate cards**: empty for every client until published via `/admin/client-rate-cards` — a client with no rate card books shipments fine but gets `client_billed_amount = null` (deferred, not guessed), which blocks invoicing them and leaves their Cash Reconciliation row showing "—" for client-charged.
- **Client-side COD charge symmetry**: `client_cod_charge_rupees` mirrors the same `max(1%, ₹20)` formula as the vendor's COD charge (`backend/src/rate-engine/client-rate-engine.ts`) — an assumption that Time Bound passes its own COD handling fee through to the client the same way; confirm against real client contracts.
- **Carrier remittance matching is AWB-only, one-to-one**: `reconcileCarrierRemittance` assumes one remittance line per AWB. If Delhivery's real remittance reports batch multiple AWBs into one lump sum or split one AWB's COD across multiple remittance dates, the matching logic needs rework before trusting it.
- **Settlement-run granularity**: `settlePeriod` folds in every *unassigned* ledger entry whose `created_at` falls in the given range, not entries logically "belonging" to that period in some other sense (e.g. a COD credit logged today for a shipment delivered last month still counts toward *today's* period, not last month's) — reasonable for a first cut, but worth revisiting if Time Bound's actual monthly-close process expects period membership to follow shipment/delivery date instead of ledger-entry date.
- **GST tax rate and CGST/SGST-vs-IGST split** (already flagged under Phase 1.5, restated here since invoices now bill real client amounts): still a placeholder 18%/always-IGST — this matters more now that invoice totals are real, client-facing numbers, not just vendor-cost stand-ins.

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
