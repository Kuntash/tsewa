-- Each organization keeps its own list of withdrawal reasons. An organization
-- with no list keeps typing the reason.
CREATE TABLE withdrawal_reason (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX withdrawal_reason_name_idx ON withdrawal_reason
  (organization_id, name);
CREATE INDEX withdrawal_reason_order_idx ON withdrawal_reason
  (organization_id, is_active, sort_order);
