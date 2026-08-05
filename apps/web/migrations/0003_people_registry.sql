CREATE TABLE IF NOT EXISTS person_import_batch (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_database TEXT NOT NULL,
  source_fingerprint TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('dry_run', 'import')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  source_count INTEGER NOT NULL DEFAULT 0 CHECK (source_count >= 0),
  imported_count INTEGER NOT NULL DEFAULT 0 CHECK (imported_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  issue_count INTEGER NOT NULL DEFAULT 0 CHECK (issue_count >= 0),
  created_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS person_import_batch_org_idx
  ON person_import_batch (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS person (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('child', 'elderly', 'staff')),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  identifier_kind TEXT NOT NULL CHECK (identifier_kind IN ('admission', 'staff')),
  primary_identifier TEXT NOT NULL,
  display_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('female', 'male', 'other', 'unknown')),
  date_of_birth TEXT,
  admitted_or_joined_on TEXT,
  campus_or_location TEXT,
  nationality TEXT,
  photo_asset_key TEXT,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES person_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, identifier_kind, primary_identifier),
  UNIQUE (organization_id, source_system, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS person_registry_filter_idx
  ON person (organization_id, kind, status, display_name COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS person_registry_name_idx
  ON person (organization_id, display_name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS person_import_issue (
  id TEXT PRIMARY KEY NOT NULL,
  import_batch_id TEXT NOT NULL REFERENCES person_import_batch(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  field_name TEXT,
  issue_code TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'error')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (import_batch_id, source_table, source_id, field_name, issue_code)
);

CREATE INDEX IF NOT EXISTS person_import_issue_batch_idx
  ON person_import_issue (import_batch_id, severity, issue_code);
