ALTER TABLE organization_invitation ADD COLUMN email_status TEXT NOT NULL DEFAULT 'not_sent'
  CHECK (email_status IN ('not_sent', 'sent', 'failed'));
ALTER TABLE organization_invitation ADD COLUMN email_message_id TEXT;
ALTER TABLE organization_invitation ADD COLUMN email_sent_at TEXT;
ALTER TABLE organization_invitation ADD COLUMN email_last_attempt_at TEXT;
ALTER TABLE organization_invitation ADD COLUMN email_attempt_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS organization_invitation_delivery_idx
  ON organization_invitation (organization_id, email_status, created_at DESC);
