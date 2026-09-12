-- GST-compliant invoice schema + generation logic (Phase 1.5 per the spec's
-- phase roadmap). The full client billing/ledger UI stays Phase 2 — this is
-- the schema plus a bare-bones trigger-and-list admin page.

alter table clients add column gstin text;
-- Needed to determine CGST+SGST (intra-state) vs IGST (inter-state) — a real
-- gap the invoice schema can't skip. Time Bound's own origin state isn't
-- captured anywhere either; assume it's supplied via a future settings
-- table or env var when the tax-split logic is actually implemented.
alter table clients add column billing_state text;

create sequence client_invoice_number_seq;

-- Placeholder format (INV/<year>/<seq>) — confirm the real numbering format
-- with whoever handles Time Bound's GST filing before invoices go out for
-- real; sequential/unique-per-financial-year is the only hard legal
-- requirement, the string shape itself isn't prescribed.
create or replace function next_invoice_number()
returns text
language sql
as $$
  select 'INV/' || to_char(current_date, 'YYYY') || '/' || lpad(nextval('client_invoice_number_seq')::text, 6, '0');
$$;

create table client_invoice (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  invoice_number text not null unique default next_invoice_number(),
  period_from date not null,
  period_to date not null,
  subtotal_rupees numeric(12,2) not null default 0,
  tax_rupees numeric(12,2) not null default 0,
  total_rupees numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'cancelled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table client_invoice_line (
  id uuid primary key default gen_random_uuid(),
  client_invoice_id uuid not null references client_invoice(id) on delete cascade,
  shipment_id uuid references shipments(id),
  description text not null,
  amount_rupees numeric(12,2) not null,
  tax_type text not null check (tax_type in ('cgst_sgst', 'igst')),
  tax_rupees numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index idx_client_invoice_client on client_invoice(client_id);
create index idx_client_invoice_line_invoice on client_invoice_line(client_invoice_id);

alter table client_invoice enable row level security;
alter table client_invoice_line enable row level security;

-- Pricing/billing data — same admin+accounts_ops-only treatment as rate_cards.
create policy "client_invoice_all" on client_invoice for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "client_invoice_line_all" on client_invoice_line for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
