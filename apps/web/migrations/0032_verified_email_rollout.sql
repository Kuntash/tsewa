-- Existing accounts predate email verification. Grandfather them so enabling
-- the verification gate does not lock current administrators out. Accounts
-- created after this migration retain Better Auth's unverified default.
UPDATE "user"
SET "emailVerified" = 1,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "emailVerified" = 0;
