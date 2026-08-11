PRAGMA foreign_keys = ON;

-- Keep imported sibling rows for history when staff remove a visible link.
ALTER TABLE person_relationship
  ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

ALTER TABLE person_relationship ADD COLUMN removed_at TEXT;

ALTER TABLE person_relationship
  ADD COLUMN updated_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;

ALTER TABLE person_family_profile
  ADD COLUMN updated_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;

CREATE INDEX person_relationship_active_pair_idx
  ON person_relationship (
    organization_id, relationship_type, person_id, related_person_id, is_active
  );
