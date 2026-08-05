CREATE TABLE IF NOT EXISTS person_academic_import_batch (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_database TEXT NOT NULL,
  source_fingerprint TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  source_count INTEGER NOT NULL DEFAULT 0 CHECK (source_count >= 0),
  imported_count INTEGER NOT NULL DEFAULT 0 CHECK (imported_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  latest_record_count INTEGER NOT NULL DEFAULT 0 CHECK (latest_record_count >= 0),
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS person_academic_import_batch_org_idx
  ON person_academic_import_batch (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS person_academic_record (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  class_level INTEGER,
  class_section TEXT,
  class_title TEXT,
  school_name TEXT,
  house_name TEXT,
  academic_session TEXT NOT NULL,
  recorded_on TEXT NOT NULL,
  result TEXT,
  roll_number TEXT,
  board_registration_number TEXT,
  description TEXT,
  is_latest INTEGER NOT NULL DEFAULT 0 CHECK (is_latest IN (0, 1)),
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES person_academic_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, source_system, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS person_academic_timeline_idx
  ON person_academic_record (organization_id, person_id, recorded_on DESC, source_id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS person_academic_one_latest_idx
  ON person_academic_record (organization_id, person_id)
  WHERE is_latest = 1;
