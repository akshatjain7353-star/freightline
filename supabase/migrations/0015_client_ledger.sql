-- Carrier COD remittance reconciliation (mirrors vendor_invoice_batch/line
-- from 0012_vendor_reconciliation.sql, but matching what the carrier remits
-- to Time Bound against shipments, not what they bill for freight) plus the
-- client ledger core (spec Section 12): two money flows per client —
--   freight (client owes Time Bound): freight_debit on invoice, freight_credit
--   on payment received
--   COD (Time Bound owes client): cod_credit when the carrier remits COD to
--   Time Bound on the client's behalf, cod_debit when Time Bound remits it
--   onward to the client
-- settlement_mode (0013) decides how a client's ledger is displayed/settled:
-- netted clients get one combined running balance settled per-period
-- (client_settlement_run); separate clients get two independent balances.

create table carrier_remittance_batch (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references carriers(id),
  file_name text,
  uploaded_by uuid references auth.users(id),
  total_lines integer not null default 0,
  matched_lines integer not null default 0,
  created_at timestamptz not null default now()
);

create table carrier_remittance_line (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references carrier_remittance_batch(id) on delete cascade,
  awb text not null,
  shipment_id uuid references shipments(id),
  remitted_amount_rupees numeric(12,2) not null,
  status text not null default 'unmatched' check (status in ('matched', 'unmatched')),
  created_at timestamptz not null default now()
);

create index idx_carrier_remittance_line_batch on carrier_remittance_line(batch_id);
create index idx_carrier_remittance_line_awb on carrier_remittance_line(awb);

create table client_payment (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  amount_rupees numeric(12,2) not null,
  payment_date date not null,
  reference text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table client_settlement_run (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  period_from date not null,
  period_to date not null,
  freight_total_rupees numeric(12,2) not null default 0,
  cod_total_rupees numeric(12,2) not null default 0,
  -- positive = Time Bound pays the client this amount; negative = client
  -- still owes Time Bound this amount for the period.
  net_amount_rupees numeric(12,2) not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create type client_ledger_entry_type as enum ('freight_debit', 'freight_credit', 'cod_credit', 'cod_debit');

create table client_ledger_entry (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  entry_type client_ledger_entry_type not null,
  amount_rupees numeric(12,2) not null,
  description text not null,
  shipment_id uuid references shipments(id),
  client_invoice_id uuid references client_invoice(id),
  client_payment_id uuid references client_payment(id),
  carrier_remittance_line_id uuid references carrier_remittance_line(id),
  -- Set once a netted-client entry is folded into a period-close run — an
  -- unassigned (null) entry in a netted client's ledger is still awaiting
  -- settlement. Prevents a later overlapping settle-period run from
  -- double-counting it.
  settlement_run_id uuid references client_settlement_run(id),
  created_at timestamptz not null default now()
);

create index idx_client_ledger_entry_client on client_ledger_entry(client_id, created_at);
create index idx_client_ledger_entry_settlement on client_ledger_entry(settlement_run_id);

alter table carrier_remittance_batch enable row level security;
alter table carrier_remittance_line enable row level security;
alter table client_payment enable row level security;
alter table client_settlement_run enable row level security;
alter table client_ledger_entry enable row level security;

-- All pricing/money-movement data — same admin+accounts_ops-only treatment
-- as rate_cards and client_invoice.
create policy "carrier_remittance_batch_all" on carrier_remittance_batch for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "carrier_remittance_line_all" on carrier_remittance_line for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "client_payment_all" on client_payment for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "client_settlement_run_all" on client_settlement_run for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "client_ledger_entry_all" on client_ledger_entry for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));

-- Section 9's third collection-status value: 'collected' means the carrier
-- has remitted the COD to Time Bound (this migration's reconciliation flow);
-- 'remitted' means Time Bound has since passed it on to the client
-- (Stage D's settlement run / separate-mode COD remittance-out).
