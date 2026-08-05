CREATE TABLE IF NOT EXISTS person_placement_import_batch (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_database TEXT NOT NULL,
  source_fingerprint TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  source_count INTEGER NOT NULL DEFAULT 0 CHECK (source_count >= 0),
  imported_count INTEGER NOT NULL DEFAULT 0 CHECK (imported_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  current_placement_count INTEGER NOT NULL DEFAULT 0 CHECK (current_placement_count >= 0),
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS person_placement_import_batch_org_idx
  ON person_placement_import_batch (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS person_placement (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  home_name TEXT NOT NULL,
  location_name TEXT,
  placement_type TEXT,
  started_on TEXT NOT NULL,
  reason TEXT,
  remarks TEXT,
  is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES person_placement_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, source_system, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS person_placement_timeline_idx
  ON person_placement (organization_id, person_id, started_on DESC, source_id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS person_placement_one_current_idx
  ON person_placement (organization_id, person_id)
  WHERE is_current = 1;
