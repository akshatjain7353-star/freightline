-- Mirror of COD reconciliation (Phase 2), but matched against
-- shipment.cost_rupees (accounting for weight-discrepancy) instead of
-- order_value — what a vendor actually bills Time Bound vs. what was quoted
-- at booking.

create table vendor_invoice_batch (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references carriers(id),
  file_name text,
  uploaded_by uuid references auth.users(id),
  total_lines integer not null default 0,
  matched_lines integer not null default 0,
  discrepancy_lines integer not null default 0,
  created_at timestamptz not null default now()
);

create table vendor_invoice_line (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references vendor_invoice_batch(id) on delete cascade,
  awb text not null,
  shipment_id uuid references shipments(id),
  vendor_billed_amount_rupees numeric(12,2) not null,
  expected_amount_rupees numeric(12,2),
  discrepancy_rupees numeric(12,2),
  status text not null default 'unmatched' check (status in ('matched', 'discrepancy', 'unmatched')),
  created_at timestamptz not null default now()
);

create index idx_vendor_invoice_line_batch on vendor_invoice_line(batch_id);
create index idx_vendor_invoice_line_awb on vendor_invoice_line(awb);

alter table vendor_invoice_batch enable row level security;
alter table vendor_invoice_line enable row level security;

create policy "vendor_invoice_batch_all" on vendor_invoice_batch for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
create policy "vendor_invoice_line_all" on vendor_invoice_line for all to authenticated
  using (current_app_role() in ('admin', 'accounts_ops'))
  with check (current_app_role() in ('admin', 'accounts_ops'));
