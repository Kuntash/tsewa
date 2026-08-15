CREATE TABLE scholarship_import_batch (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_database TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL,
  scholarship_count INTEGER NOT NULL DEFAULT 0,
  annual_detail_count INTEGER NOT NULL DEFAULT 0,
  sanction_count INTEGER NOT NULL DEFAULT 0,
  sanction_line_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scholarship_course_category (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES scholarship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX scholarship_course_category_source_idx ON scholarship_course_category
  (organization_id, source_system, source_table, source_id);
CREATE INDEX scholarship_course_category_name_idx ON scholarship_course_category
  (organization_id, is_active, name);

CREATE TABLE scholarship_course (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES scholarship_course_category(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES scholarship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX scholarship_course_source_idx ON scholarship_course
  (organization_id, source_system, source_table, source_id);
CREATE INDEX scholarship_course_name_idx ON scholarship_course (organization_id, is_active, name);

CREATE TABLE scholarship_head (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES scholarship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX scholarship_head_source_idx ON scholarship_head
  (organization_id, source_system, source_table, source_id);
CREATE INDEX scholarship_head_name_idx ON scholarship_head (organization_id, is_active, name);

CREATE TABLE scholarship_record (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  person_id TEXT REFERENCES person(id) ON DELETE SET NULL,
  academic_session_id TEXT REFERENCES academic_session(id) ON DELETE SET NULL,
  course_id TEXT REFERENCES scholarship_course(id) ON DELETE SET NULL,
  beneficiary_category TEXT,
  student_name TEXT NOT NULL,
  admission_number TEXT,
  father_name TEXT,
  gender TEXT,
  date_of_birth TEXT,
  class_stream TEXT,
  class_percentage REAL,
  admission_year INTEGER,
  course_duration TEXT,
  college_training INTEGER NOT NULL DEFAULT 0,
  city_name TEXT,
  permanent_address TEXT,
  mailing_address TEXT,
  special_allowance INTEGER NOT NULL DEFAULT 0,
  scholarship_awarded REAL,
  institute_name TEXT,
  bank_account_number TEXT,
  ward_health_record TEXT,
  needy_case TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  phone TEXT,
  ledger_number TEXT,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES scholarship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX scholarship_record_source_idx ON scholarship_record
  (organization_id, source_system, source_table, source_id);
CREATE INDEX scholarship_record_filter_idx ON scholarship_record
  (organization_id, status, course_id, student_name);
CREATE INDEX scholarship_record_person_idx ON scholarship_record (organization_id, person_id);

CREATE TABLE scholarship_annual_detail (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  scholarship_id TEXT REFERENCES scholarship_record(id) ON DELETE CASCADE,
  academic_session_id TEXT REFERENCES academic_session(id) ON DELETE SET NULL,
  legacy_scholarship_id TEXT,
  study_year TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  percentage REAL,
  division TEXT,
  fees REAL,
  remarks TEXT,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES scholarship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX scholarship_annual_source_idx ON scholarship_annual_detail
  (organization_id, source_system, source_table, source_id);
CREATE INDEX scholarship_annual_record_idx ON scholarship_annual_detail
  (organization_id, scholarship_id, study_year);

CREATE TABLE scholarship_sanction (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  scholarship_id TEXT NOT NULL REFERENCES scholarship_record(id) ON DELETE CASCADE,
  academic_session_id TEXT REFERENCES academic_session(id) ON DELETE SET NULL,
  amount REAL NOT NULL,
  sanctioned_on TEXT NOT NULL,
  period_from TEXT,
  period_to TEXT,
  payment_reference TEXT,
  in_favour_of TEXT,
  remarks TEXT,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES scholarship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX scholarship_sanction_source_idx ON scholarship_sanction
  (organization_id, source_system, source_table, source_id);
CREATE INDEX scholarship_sanction_record_idx ON scholarship_sanction
  (organization_id, scholarship_id, sanctioned_on DESC);

CREATE TABLE scholarship_sanction_line (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  sanction_id TEXT REFERENCES scholarship_sanction(id) ON DELETE CASCADE,
  scholarship_id TEXT REFERENCES scholarship_record(id) ON DELETE SET NULL,
  person_id TEXT REFERENCES person(id) ON DELETE SET NULL,
  head_id TEXT NOT NULL REFERENCES scholarship_head(id) ON DELETE RESTRICT,
  city_name TEXT,
  amount REAL NOT NULL,
  advance_on TEXT,
  legacy_sanction_id TEXT,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES scholarship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX scholarship_sanction_line_source_idx ON scholarship_sanction_line
  (organization_id, source_system, source_table, source_id);
CREATE INDEX scholarship_sanction_line_parent_idx ON scholarship_sanction_line
  (organization_id, sanction_id, head_id);

CREATE TABLE scholarship_city_advance (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  academic_session_id TEXT REFERENCES academic_session(id) ON DELETE SET NULL,
  city_name TEXT NOT NULL,
  amount REAL NOT NULL,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES scholarship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX scholarship_city_advance_source_idx ON scholarship_city_advance
  (organization_id, source_system, source_table, source_id);
CREATE INDEX scholarship_city_advance_city_idx ON scholarship_city_advance
  (organization_id, city_name);

CREATE TABLE scholarship_limit (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  course_group TEXT NOT NULL,
  head_name TEXT NOT NULL,
  amount REAL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES scholarship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX scholarship_limit_source_idx ON scholarship_limit
  (organization_id, source_system, source_table, source_id);
CREATE INDEX scholarship_limit_group_idx ON scholarship_limit
  (organization_id, is_active, course_group, head_name);
