ALTER TABLE person_file ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));
ALTER TABLE person_file ADD COLUMN removed_at TEXT;
ALTER TABLE person_file ADD COLUMN created_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE person_file ADD COLUMN updated_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE person_file ADD COLUMN replaces_file_id TEXT REFERENCES person_file(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS person_file_active_person_idx
  ON person_file (organization_id, person_id, is_active, category, label);
