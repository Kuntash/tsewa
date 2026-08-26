CREATE TABLE organization_subscription (
  organization_id TEXT PRIMARY KEY NOT NULL
    REFERENCES organization(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL DEFAULT 'hosted',
  status TEXT NOT NULL DEFAULT 'complimentary'
    CHECK (status IN ('active', 'canceled', 'complimentary', 'past_due', 'trialing')),
  trial_ends_at TEXT,
  current_period_ends_at TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  provider_event_at TEXT,
  billing_interval TEXT CHECK (billing_interval IN ('monthly', 'yearly')),
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0
    CHECK (cancel_at_period_end IN (0, 1)),
  active_person_limit INTEGER NOT NULL DEFAULT 500,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX organization_subscription_provider_customer_idx
ON organization_subscription (provider_customer_id)
WHERE provider_customer_id IS NOT NULL;

CREATE UNIQUE INDEX organization_subscription_provider_subscription_idx
ON organization_subscription (provider_subscription_id)
WHERE provider_subscription_id IS NOT NULL;

CREATE TABLE billing_webhook_event (
  id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL,
  provider_subscription_id TEXT,
  event_timestamp TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  failure_reason TEXT
);

CREATE INDEX billing_webhook_subscription_idx
ON billing_webhook_event (provider_subscription_id);

-- Existing organisations retain uninterrupted access while checkout is introduced.
INSERT INTO organization_subscription (organization_id, status)
SELECT id, 'complimentary' FROM organization;
