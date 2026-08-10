CREATE TABLE IF NOT EXISTS person_file_import_batch (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_database TEXT NOT NULL,
  source_fingerprint TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  selected_person_count INTEGER NOT NULL DEFAULT 0 CHECK (selected_person_count >= 0),
  source_file_count INTEGER NOT NULL DEFAULT 0 CHECK (source_file_count >= 0),
  imported_file_count INTEGER NOT NULL DEFAULT 0 CHECK (imported_file_count >= 0),
  source_byte_count INTEGER NOT NULL DEFAULT 0 CHECK (source_byte_count >= 0),
  imported_byte_count INTEGER NOT NULL DEFAULT 0 CHECK (imported_byte_count >= 0),
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS person_file_import_batch_org_idx
  ON person_file_import_batch (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS person_file (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN (
      'profile_photo',
      'parents_photo',
      'guardian_1_photo',
      'guardian_2_photo',
      'document'
    )
  ),
  label TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  sha256 TEXT NOT NULL,
  r2_object_key TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_asset_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES person_file_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, source_system, source_asset_id),
  UNIQUE (organization_id, r2_object_key)
);

CREATE INDEX IF NOT EXISTS person_file_person_idx
  ON person_file (organization_id, person_id, category, label);

CREATE INDEX IF NOT EXISTS person_file_source_idx
  ON person_file (organization_id, source_table, source_id);
