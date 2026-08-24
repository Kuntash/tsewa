CREATE TABLE staff_import_batch (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_database TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL,
  department_count INTEGER NOT NULL DEFAULT 0,
  designation_count INTEGER NOT NULL DEFAULT 0,
  category_count INTEGER NOT NULL DEFAULT 0,
  profile_count INTEGER NOT NULL DEFAULT 0,
  employment_event_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staff_department (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES staff_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX staff_department_source_idx ON staff_department
  (organization_id, source_system, source_table, source_id);
CREATE INDEX staff_department_name_idx ON staff_department (organization_id, is_active, name);

CREATE TABLE staff_designation (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  department_id TEXT REFERENCES staff_department(id) ON DELETE SET NULL,
  legacy_department_id TEXT,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES staff_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX staff_designation_source_idx ON staff_designation
  (organization_id, source_system, source_table, source_id);
CREATE INDEX staff_designation_name_idx ON staff_designation
  (organization_id, department_id, is_active, name);

CREATE TABLE staff_category (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES staff_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX staff_category_source_idx ON staff_category
  (organization_id, source_system, source_table, source_id);

CREATE TABLE staff_profile (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  department_id TEXT REFERENCES staff_department(id) ON DELETE SET NULL,
  designation_id TEXT REFERENCES staff_designation(id) ON DELETE SET NULL,
  category_id TEXT REFERENCES staff_category(id) ON DELETE SET NULL,
  legacy_department_id TEXT,
  legacy_designation_id TEXT,
  permanent_on TEXT,
  spouse_name TEXT,
  settlement_name TEXT,
  allocated_place TEXT,
  mother_name TEXT,
  father_name TEXT,
  address TEXT,
  marital_status TEXT,
  registration_certificate_number TEXT,
  pan_number TEXT,
  phone TEXT,
  email TEXT,
  quarter_number TEXT,
  nominee TEXT,
  birth_place TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  withdrawal_reason TEXT,
  withdrawal_on TEXT,
  identity_card_number TEXT,
  green_book_number TEXT,
  remarks TEXT,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES staff_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX staff_profile_person_idx ON staff_profile (organization_id, person_id);
CREATE UNIQUE INDEX staff_profile_source_idx ON staff_profile
  (organization_id, source_system, source_table, source_id);
CREATE INDEX staff_profile_directory_idx ON staff_profile
  (organization_id, department_id, designation_id, person_id);

CREATE TABLE staff_employment_event (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  department_id TEXT REFERENCES staff_department(id) ON DELETE SET NULL,
  designation_id TEXT REFERENCES staff_designation(id) ON DELETE SET NULL,
  legacy_department_id TEXT,
  legacy_designation_id TEXT,
  location_name TEXT,
  effective_on TEXT,
  transfer_reason TEXT,
  remarks TEXT,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES staff_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX staff_employment_event_source_idx ON staff_employment_event
  (organization_id, source_system, source_table, source_id);
CREATE INDEX staff_employment_event_timeline_idx ON staff_employment_event
  (organization_id, person_id, effective_on DESC);
