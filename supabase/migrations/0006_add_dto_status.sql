-- Postgres requires a new enum value to be committed before it can be used
-- in the same session, so this is a standalone migration ahead of the
-- shipment-schema changes in 0007 that will eventually produce 'dto' rows.
alter type shipment_status add value if not exists 'dto';
