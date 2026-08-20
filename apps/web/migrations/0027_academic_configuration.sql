CREATE TABLE academic_subject_type (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  academic_session_id TEXT NOT NULL REFERENCES academic_session(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX academic_subject_type_name_idx
  ON academic_subject_type (organization_id, academic_session_id, name COLLATE NOCASE);

CREATE TABLE academic_subject_head (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  academic_session_id TEXT NOT NULL REFERENCES academic_session(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX academic_subject_head_name_idx
  ON academic_subject_head (organization_id, academic_session_id, name COLLATE NOCASE);

CREATE TABLE academic_grade_type (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  academic_session_id TEXT NOT NULL REFERENCES academic_session(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX academic_grade_type_name_idx
  ON academic_grade_type (organization_id, academic_session_id, name COLLATE NOCASE);

CREATE TABLE academic_grade (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  grade_type_id TEXT NOT NULL REFERENCES academic_grade_type(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  starts_at REAL NOT NULL,
  ends_at REAL NOT NULL,
  points REAL NOT NULL,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (starts_at <= ends_at)
);

CREATE UNIQUE INDEX academic_grade_range_idx
  ON academic_grade (organization_id, grade_type_id, name COLLATE NOCASE);

ALTER TABLE academic_subject ADD COLUMN subject_type_id TEXT
  REFERENCES academic_subject_type(id) ON DELETE SET NULL;
ALTER TABLE academic_subject ADD COLUMN subject_head_id TEXT
  REFERENCES academic_subject_head(id) ON DELETE SET NULL;
ALTER TABLE academic_subject ADD COLUMN grade_type_id TEXT
  REFERENCES academic_grade_type(id) ON DELETE SET NULL;

CREATE INDEX academic_subject_configuration_idx
  ON academic_subject (organization_id, academic_session_id, subject_type_id, subject_head_id);

CREATE TABLE academic_class_subject (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  academic_session_id TEXT NOT NULL REFERENCES academic_session(id) ON DELETE CASCADE,
  academic_class_id TEXT NOT NULL REFERENCES academic_class_master(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES academic_subject(id) ON DELETE CASCADE,
  maximum_marks REAL,
  display_order INTEGER,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX academic_class_subject_scope_idx
  ON academic_class_subject (organization_id, academic_session_id, academic_class_id, subject_id);
CREATE INDEX academic_class_subject_order_idx
  ON academic_class_subject (organization_id, academic_session_id, academic_class_id, display_order);

CREATE TABLE academic_class_subject_assessment (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  academic_session_id TEXT NOT NULL REFERENCES academic_session(id) ON DELETE CASCADE,
  academic_class_id TEXT NOT NULL REFERENCES academic_class_master(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES academic_subject(id) ON DELETE CASCADE,
  assessment_id TEXT NOT NULL REFERENCES academic_assessment(id) ON DELETE CASCADE,
  maximum_marks REAL,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX academic_class_subject_assessment_scope_idx
  ON academic_class_subject_assessment
    (organization_id, academic_session_id, academic_class_id, subject_id, assessment_id);
