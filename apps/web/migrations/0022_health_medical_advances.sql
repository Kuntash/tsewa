PRAGMA foreign_keys = ON;

ALTER TABLE health_history_import_batch ADD COLUMN medical_advance_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE health_history_import_batch ADD COLUMN medical_advance_detail_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE health_history_import_batch ADD COLUMN medical_settlement_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS health_medical_advance (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  sanctioned_on TEXT NOT NULL,
  nurse_name TEXT,
  sanction_number TEXT,
  advance_amount REAL NOT NULL,
  referring_doctor_name TEXT,
  referral_location TEXT,
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

CREATE INDEX IF NOT EXISTS health_medical_advance_date_idx
  ON health_medical_advance (organization_id, sanctioned_on DESC, sanction_number);

CREATE TABLE IF NOT EXISTS health_medical_advance_detail (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  medical_advance_id TEXT NOT NULL REFERENCES health_medical_advance(id) ON DELETE CASCADE,
  person_id TEXT REFERENCES person(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_kind TEXT NOT NULL CHECK (patient_kind IN ('child', 'elderly', 'staff', 'other')),
  sanction_type TEXT NOT NULL,
  home_name TEXT,
  gender TEXT,
  age_at_sanction INTEGER,
  medication TEXT,
  referred_to_doctor_name TEXT,
  hospital_registration_number TEXT,
  hospital_referred_to TEXT,
  hospital_admitted TEXT,
  diagnosis TEXT,
  admitted_on TEXT,
  discharged_on TEXT,
  surgery_type TEXT,
  amount REAL,
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

CREATE INDEX IF NOT EXISTS health_medical_advance_detail_advance_idx
  ON health_medical_advance_detail (organization_id, medical_advance_id, patient_name);
CREATE INDEX IF NOT EXISTS health_medical_advance_detail_person_idx
  ON health_medical_advance_detail (organization_id, person_id, medical_advance_id);

CREATE TABLE IF NOT EXISTS health_medical_settlement (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  medical_advance_id TEXT NOT NULL REFERENCES health_medical_advance(id) ON DELETE CASCADE,
  settled_on TEXT NOT NULL,
  bill_number TEXT,
  nurse_tada REAL,
  total_expenses REAL,
  extra_expenses REAL,
  balance REAL,
  remarks TEXT,
  legacy_settlement_id TEXT NOT NULL,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES health_history_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, source_system, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS health_medical_settlement_advance_idx
  ON health_medical_settlement (organization_id, medical_advance_id, settled_on DESC);
