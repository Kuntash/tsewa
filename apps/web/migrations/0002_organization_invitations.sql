CREATE TABLE IF NOT EXISTS organization_invitation (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  accepted_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS organization_invitation_org_idx
  ON organization_invitation (organization_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS organization_invitation_active_email_idx
  ON organization_invitation (organization_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
