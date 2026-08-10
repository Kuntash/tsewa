PRAGMA foreign_keys = ON;

ALTER TABLE academic_session ADD COLUMN source_system TEXT;
ALTER TABLE academic_session ADD COLUMN source_table TEXT;
ALTER TABLE academic_session ADD COLUMN source_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS academic_session_source_idx
  ON academic_session (organization_id, source_system, source_table, source_id)
  WHERE source_system IS NOT NULL AND source_table IS NOT NULL AND source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS school_operations_import_batch (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_database TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  session_count INTEGER NOT NULL DEFAULT 0 CHECK (session_count >= 0),
  school_count INTEGER NOT NULL DEFAULT 0 CHECK (school_count >= 0),
  class_count INTEGER NOT NULL DEFAULT 0 CHECK (class_count >= 0),
  house_count INTEGER NOT NULL DEFAULT 0 CHECK (house_count >= 0),
  school_house_count INTEGER NOT NULL DEFAULT 0 CHECK (school_house_count >= 0),
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS school_operations_import_batch_org_idx
  ON school_operations_import_batch (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS school_master (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_name TEXT,
  affiliation_number TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES school_operations_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, source_system, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS school_master_org_name_idx
  ON school_master (organization_id, name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS academic_class_master (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level INTEGER,
  section TEXT,
  title TEXT,
  sort_order INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES school_operations_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, source_system, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS academic_class_master_org_sort_idx
  ON academic_class_master (organization_id, sort_order, level, section, name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS house_master (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES school_operations_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, source_system, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS house_master_org_name_idx
  ON house_master (organization_id, name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS school_house_master (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  school_id TEXT NOT NULL REFERENCES school_master(id) ON DELETE CASCADE,
  house_id TEXT NOT NULL REFERENCES house_master(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES school_operations_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, source_system, source_table, source_id),
  UNIQUE (organization_id, school_id, house_id)
);

CREATE INDEX IF NOT EXISTS school_house_master_org_school_idx
  ON school_house_master (organization_id, school_id, house_id);
