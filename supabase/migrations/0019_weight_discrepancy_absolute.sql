-- Weight discrepancy threshold was wrong: it flagged a >10% relative
-- difference between vendor_charged_weight and chargeable_weight_grams.
-- The confirmed rule is an absolute difference of more than 10 grams.

create or replace function set_weight_discrepancy_flag()
returns trigger as $$
begin
  if new.vendor_charged_weight is not null then
    new.weight_discrepancy_flagged := abs(new.vendor_charged_weight - new.chargeable_weight_grams) > 10;
  else
    new.weight_discrepancy_flagged := false;
  end if;

  -- Only auto-set to 'flagged' the first time a discrepancy appears - never
  -- overwrite an ops decision (accepted/disputed/resolved) on a later write.
  if new.weight_discrepancy_flagged and new.weight_discrepancy_status is null then
    new.weight_discrepancy_status := 'flagged';
  end if;

  return new;
end;
$$ language plpgsql;

-- Re-evaluate every existing row that already has a vendor_charged_weight
-- against the corrected (absolute, not relative) threshold above - the
-- trigger is "before update OF vendor_charged_weight", so writing the same
-- value back re-fires it without needing a reseed.
update shipments set vendor_charged_weight = vendor_charged_weight where vendor_charged_weight is not null;
