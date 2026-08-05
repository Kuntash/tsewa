CREATE TABLE IF NOT EXISTS person_family_import_batch (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_database TEXT NOT NULL,
  source_fingerprint TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  source_profile_count INTEGER NOT NULL DEFAULT 0 CHECK (source_profile_count >= 0),
  imported_profile_count INTEGER NOT NULL DEFAULT 0 CHECK (imported_profile_count >= 0),
  source_relationship_count INTEGER NOT NULL DEFAULT 0 CHECK (source_relationship_count >= 0),
  imported_relationship_count INTEGER NOT NULL DEFAULT 0 CHECK (imported_relationship_count >= 0),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS person_family_import_batch_org_idx
  ON person_family_import_batch (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS person_family_profile (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  parentage_status TEXT,
  mother_name TEXT,
  father_name TEXT,
  mother_occupation TEXT,
  father_occupation TEXT,
  parents_phone TEXT,
  parents_permanent_address TEXT,
  guardian_1_name TEXT,
  guardian_1_address TEXT,
  guardian_1_email TEXT,
  guardian_1_phone TEXT,
  guardian_1_mobile TEXT,
  guardian_2_name TEXT,
  guardian_2_address TEXT,
  guardian_2_email TEXT,
  guardian_2_phone TEXT,
  guardian_2_mobile TEXT,
  marital_status TEXT,
  spouse_name TEXT,
  number_of_children TEXT,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES person_family_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, person_id),
  UNIQUE (organization_id, source_system, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS person_family_profile_person_idx
  ON person_family_profile (organization_id, person_id);

CREATE TABLE IF NOT EXISTS person_relationship (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  related_person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('sibling')),
  review_flag TEXT CHECK (review_flag IN ('self_reference', 'duplicate_source_link')),
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  import_batch_id TEXT REFERENCES person_family_import_batch(id) ON DELETE SET NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, source_system, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS person_relationship_person_idx
  ON person_relationship (organization_id, person_id, relationship_type, related_person_id);

CREATE INDEX IF NOT EXISTS person_relationship_related_idx
  ON person_relationship (organization_id, related_person_id, relationship_type, person_id);
