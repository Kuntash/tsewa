PRAGMA foreign_keys = ON;

ALTER TABLE health_history_import_batch ADD COLUMN tb_case_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE health_history_import_batch ADD COLUMN tb_detail_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS health_tb_case (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  person_id TEXT REFERENCES person(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_kind TEXT NOT NULL CHECK (patient_kind IN ('child', 'elderly', 'staff', 'other')),
  tb_card_number TEXT,
  admission_number TEXT,
  father_name TEXT,
  gender TEXT,
  age_at_registration INTEGER,
  home_name TEXT,
  treatment_regimen TEXT,
  registration_date TEXT NOT NULL,
  treatment_start_date TEXT,
  treatment_end_date TEXT,
  outcome TEXT,
  tb_type TEXT,
  case_type TEXT,
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

CREATE INDEX IF NOT EXISTS health_tb_case_date_idx
  ON health_tb_case (organization_id, registration_date DESC, patient_name);
CREATE INDEX IF NOT EXISTS health_tb_case_person_idx
  ON health_tb_case (organization_id, person_id, registration_date DESC);

CREATE TABLE IF NOT EXISTS health_tb_detail (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  tb_case_id TEXT NOT NULL REFERENCES health_tb_case(id) ON DELETE CASCADE,
  recorded_on TEXT NOT NULL,
  test_name TEXT NOT NULL,
  result TEXT,
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

CREATE INDEX IF NOT EXISTS health_tb_detail_case_idx
  ON health_tb_detail (organization_id, tb_case_id, recorded_on DESC);
