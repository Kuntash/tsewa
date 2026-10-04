-- Each organization keeps its own child categories; the names are not part of
-- the product.
CREATE TABLE child_category (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  imported_at TEXT,
  created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX child_category_source_idx ON child_category
  (organization_id, source_system, source_table, source_id);
CREATE INDEX child_category_name_idx ON child_category
  (organization_id, is_active, name);

ALTER TABLE person ADD COLUMN green_book_number TEXT;
ALTER TABLE person ADD COLUMN previous_school_name TEXT;
ALTER TABLE person ADD COLUMN transfer_certificate_number TEXT;
ALTER TABLE person ADD COLUMN child_category_id TEXT REFERENCES child_category(id) ON DELETE SET NULL;
