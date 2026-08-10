PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS student_enrollment_import_batch (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_database TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  source_row_count INTEGER NOT NULL DEFAULT 0 CHECK (source_row_count >= 0),
  enrollment_count INTEGER NOT NULL DEFAULT 0 CHECK (enrollment_count >= 0),
  superseded_row_count INTEGER NOT NULL DEFAULT 0 CHECK (superseded_row_count >= 0),
  offering_count INTEGER NOT NULL DEFAULT 0 CHECK (offering_count >= 0),
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS student_enrollment_import_batch_org_idx
  ON student_enrollment_import_batch (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS school_class_offering (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  academic_session_id TEXT NOT NULL REFERENCES academic_session(id) ON DELETE CASCADE,
  school_id TEXT NOT NULL REFERENCES school_master(id) ON DELETE CASCADE,
  academic_class_id TEXT NOT NULL REFERENCES academic_class_master(id) ON DELETE CASCADE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  origin TEXT NOT NULL CHECK (origin IN ('legacy_observed', 'manual')),
  source_system TEXT,
  source_table TEXT,
  source_id TEXT,
  import_batch_id TEXT REFERENCES student_enrollment_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, academic_session_id, school_id, academic_class_id),
  UNIQUE (organization_id, source_system, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS school_class_offering_roster_idx
  ON school_class_offering (
    organization_id, academic_session_id, school_id, academic_class_id, is_active
  );

CREATE TABLE IF NOT EXISTS student_enrollment (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  academic_session_id TEXT NOT NULL REFERENCES academic_session(id) ON DELETE CASCADE,
  school_id TEXT REFERENCES school_master(id) ON DELETE RESTRICT,
  academic_class_id TEXT NOT NULL REFERENCES academic_class_master(id) ON DELETE RESTRICT,
  house_id TEXT REFERENCES house_master(id) ON DELETE RESTRICT,
  school_class_offering_id TEXT REFERENCES school_class_offering(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'recorded'
    CHECK (status IN ('recorded', 'enrolled', 'transferred', 'withdrawn', 'completed', 'graduated')),
  status_source TEXT NOT NULL DEFAULT 'legacy_allocation'
    CHECK (status_source IN ('legacy_allocation', 'explicit')),
  started_on TEXT,
  ended_on TEXT,
  source_recorded_on TEXT,
  roll_number TEXT,
  board_registration_number TEXT,
  result TEXT,
  source_academic_record_id TEXT REFERENCES person_academic_record(id) ON DELETE SET NULL,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES student_enrollment_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, person_id, academic_session_id),
  UNIQUE (organization_id, source_system, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS student_enrollment_session_roster_idx
  ON student_enrollment (
    organization_id, academic_session_id, school_id, academic_class_id, status
  );

CREATE INDEX IF NOT EXISTS student_enrollment_person_history_idx
  ON student_enrollment (organization_id, person_id, academic_session_id);
