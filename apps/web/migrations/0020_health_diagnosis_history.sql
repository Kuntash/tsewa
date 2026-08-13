PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS health_history_import_batch (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_database TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  visit_count INTEGER NOT NULL DEFAULT 0,
  diagnosis_count INTEGER NOT NULL DEFAULT 0,
  linked_person_count INTEGER NOT NULL DEFAULT 0,
  unlinked_person_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS health_visit (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  person_id TEXT REFERENCES person(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_kind TEXT NOT NULL CHECK (patient_kind IN ('child', 'elderly', 'staff', 'other')),
  admission_number TEXT,
  gender TEXT,
  home_name TEXT,
  age_at_visit INTEGER,
  checkup_date TEXT NOT NULL,
  admitted_on TEXT,
  discharged_on TEXT,
  doctor_name TEXT,
  referred_to TEXT,
  referral_location TEXT,
  remarks TEXT,
  hepatitis_b_status TEXT,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES health_history_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, source_system, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS health_visit_date_idx
  ON health_visit (organization_id, checkup_date DESC, patient_name);
CREATE INDEX IF NOT EXISTS health_visit_person_idx
  ON health_visit (organization_id, person_id, checkup_date DESC);

CREATE TABLE IF NOT EXISTS health_diagnosis (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  health_visit_id TEXT NOT NULL REFERENCES health_visit(id) ON DELETE CASCADE,
  diagnosis_name TEXT NOT NULL,
  recorded_on TEXT,
  remarks TEXT,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES health_history_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, source_system, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS health_diagnosis_visit_idx
  ON health_diagnosis (organization_id, health_visit_id, recorded_on);
