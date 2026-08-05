ALTER TABLE person_import_batch
  ADD COLUMN eligible_count INTEGER NOT NULL DEFAULT 0 CHECK (eligible_count >= 0);

CREATE TABLE IF NOT EXISTS person_import_issue_summary (
  import_batch_id TEXT NOT NULL REFERENCES person_import_batch(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  issue_code TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'error')),
  record_count INTEGER NOT NULL CHECK (record_count >= 0),
  PRIMARY KEY (import_batch_id, source_table, issue_code)
);

CREATE INDEX IF NOT EXISTS person_import_issue_summary_batch_idx
  ON person_import_issue_summary (import_batch_id, severity, issue_code);
