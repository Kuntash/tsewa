ALTER TABLE house_master ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

CREATE INDEX IF NOT EXISTS house_master_active_name_idx
  ON house_master (organization_id, is_active, name COLLATE NOCASE);
