CREATE TABLE sponsorship_import_batch (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_database TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL,
  individual_count INTEGER NOT NULL DEFAULT 0,
  assignment_count INTEGER NOT NULL DEFAULT 0,
  fund_count INTEGER NOT NULL DEFAULT 0,
  allocation_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sponsorship_organization (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country_name TEXT,
  supports_children INTEGER NOT NULL DEFAULT 0,
  supports_elderly INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES sponsorship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX sponsorship_organization_source_idx ON sponsorship_organization
  (organization_id, source_system, source_table, source_id);
CREATE INDEX sponsorship_organization_name_idx ON sponsorship_organization
  (organization_id, is_active, name);

CREATE TABLE sponsorship_sponsor_type (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES sponsorship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX sponsorship_sponsor_type_source_idx ON sponsorship_sponsor_type
  (organization_id, source_system, source_table, source_id);

CREATE TABLE sponsorship_sponsor_category (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES sponsorship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX sponsorship_sponsor_category_source_idx ON sponsorship_sponsor_category
  (organization_id, source_system, source_table, source_id);

CREATE TABLE sponsorship_status (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES sponsorship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX sponsorship_status_source_idx ON sponsorship_status
  (organization_id, source_system, source_table, source_id);

CREATE TABLE sponsorship_individual (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  sponsor_organization_id TEXT REFERENCES sponsorship_organization(id) ON DELETE SET NULL,
  legacy_sponsor_organization_id TEXT,
  sponsor_type_id TEXT REFERENCES sponsorship_sponsor_type(id) ON DELETE SET NULL,
  sponsor_category_id TEXT REFERENCES sponsorship_sponsor_category(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT,
  display_name TEXT NOT NULL,
  address TEXT,
  country_name TEXT,
  email TEXT,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES sponsorship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX sponsorship_individual_source_idx ON sponsorship_individual
  (organization_id, source_system, source_table, source_id);
CREATE INDEX sponsorship_individual_search_idx ON sponsorship_individual
  (organization_id, is_active, display_name);

CREATE TABLE sponsorship_assignment (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  sponsor_individual_id TEXT NOT NULL REFERENCES sponsorship_individual(id) ON DELETE CASCADE,
  sponsorship_status_id TEXT NOT NULL REFERENCES sponsorship_status(id) ON DELETE RESTRICT,
  academic_session_id TEXT REFERENCES academic_session(id) ON DELETE SET NULL,
  status_on TEXT,
  remarks TEXT,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES sponsorship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX sponsorship_assignment_source_idx ON sponsorship_assignment
  (organization_id, source_system, source_table, source_id);
CREATE INDEX sponsorship_assignment_person_idx ON sponsorship_assignment
  (organization_id, person_id, status_on DESC);
CREATE INDEX sponsorship_assignment_sponsor_idx ON sponsorship_assignment
  (organization_id, sponsor_individual_id, status_on DESC);

CREATE TABLE sponsorship_fund_type (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES sponsorship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX sponsorship_fund_type_source_idx ON sponsorship_fund_type
  (organization_id, source_system, source_table, source_id);

CREATE TABLE sponsorship_visitor_type (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES sponsorship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX sponsorship_visitor_type_source_idx ON sponsorship_visitor_type
  (organization_id, source_system, source_table, source_id);

CREATE TABLE sponsorship_visitor (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  visitor_type_id TEXT REFERENCES sponsorship_visitor_type(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT,
  display_name TEXT NOT NULL,
  address TEXT,
  country_name TEXT,
  email TEXT,
  phone TEXT,
  related_person_name TEXT,
  visited_on TEXT,
  memento_quantity INTEGER,
  gifts_presented TEXT,
  visit_summary TEXT,
  comments TEXT,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES sponsorship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX sponsorship_visitor_source_idx ON sponsorship_visitor
  (organization_id, source_system, source_table, source_id);
CREATE INDEX sponsorship_visitor_date_idx ON sponsorship_visitor
  (organization_id, visited_on DESC, display_name);

CREATE TABLE sponsorship_fund (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  fund_type_id TEXT NOT NULL REFERENCES sponsorship_fund_type(id) ON DELETE RESTRICT,
  academic_session_id TEXT REFERENCES academic_session(id) ON DELETE SET NULL,
  sponsor_kind TEXT NOT NULL,
  sponsor_individual_id TEXT REFERENCES sponsorship_individual(id) ON DELETE SET NULL,
  sponsor_organization_id TEXT REFERENCES sponsorship_organization(id) ON DELETE SET NULL,
  visitor_id TEXT REFERENCES sponsorship_visitor(id) ON DELETE SET NULL,
  legacy_sponsor_party_id TEXT,
  received_on TEXT NOT NULL,
  period_from TEXT,
  period_to TEXT,
  amount REAL NOT NULL,
  receipt_number TEXT,
  remarks TEXT,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES sponsorship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX sponsorship_fund_source_idx ON sponsorship_fund
  (organization_id, source_system, source_table, source_id);
CREATE INDEX sponsorship_fund_date_idx ON sponsorship_fund
  (organization_id, received_on DESC, fund_type_id);

CREATE TABLE sponsorship_fund_allocation (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  fund_id TEXT NOT NULL REFERENCES sponsorship_fund(id) ON DELETE CASCADE,
  person_id TEXT REFERENCES person(id) ON DELETE SET NULL,
  legacy_beneficiary_id TEXT,
  academic_session_id TEXT REFERENCES academic_session(id) ON DELETE SET NULL,
  amount REAL NOT NULL,
  receipt_number TEXT,
  period_from TEXT,
  period_to TEXT,
  remarks TEXT,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES sponsorship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX sponsorship_fund_allocation_source_idx ON sponsorship_fund_allocation
  (organization_id, source_system, source_table, source_id);
CREATE INDEX sponsorship_fund_allocation_parent_idx ON sponsorship_fund_allocation
  (organization_id, fund_id, person_id);

CREATE TABLE sponsorship_correspondence_type (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES sponsorship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX sponsorship_correspondence_type_source_idx ON sponsorship_correspondence_type
  (organization_id, source_system, source_table, source_id);

CREATE TABLE sponsorship_letter (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  correspondence_type_id TEXT NOT NULL REFERENCES sponsorship_correspondence_type(id) ON DELETE RESTRICT,
  sponsor_individual_id TEXT REFERENCES sponsorship_individual(id) ON DELETE SET NULL,
  person_id TEXT REFERENCES person(id) ON DELETE SET NULL,
  academic_session_id TEXT REFERENCES academic_session(id) ON DELETE SET NULL,
  sender TEXT,
  receiver TEXT,
  received_on TEXT NOT NULL,
  replied_on TEXT,
  reply_due_on TEXT,
  remarks TEXT,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES sponsorship_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX sponsorship_letter_source_idx ON sponsorship_letter
  (organization_id, source_system, source_table, source_id);
CREATE INDEX sponsorship_letter_date_idx ON sponsorship_letter
  (organization_id, received_on DESC, correspondence_type_id);
