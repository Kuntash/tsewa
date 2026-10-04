-- Withdrawal is recorded on the person so it is available even when no school
-- enrollment covers the date the person left.
ALTER TABLE person ADD COLUMN withdrawn_on TEXT;
ALTER TABLE person ADD COLUMN withdrawal_reason TEXT;
ALTER TABLE person ADD COLUMN withdrawal_remarks TEXT;
