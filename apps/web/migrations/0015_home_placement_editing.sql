PRAGMA foreign_keys = ON;

-- New placements are appended to the timeline. Imported rows remain intact and
-- are marked as previous when a staff member records a change.
ALTER TABLE person_placement ADD COLUMN ended_on TEXT;
ALTER TABLE person_placement
  ADD COLUMN created_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE person_placement
  ADD COLUMN updated_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;

CREATE INDEX person_placement_current_home_idx
  ON person_placement (organization_id, home_name, is_current);
