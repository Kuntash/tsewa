# Tsewa TODO

## Invitation UX follow-ups

- [ ] Show a dedicated invalid, expired, revoked, or already-used invitation
      screen instead of falling back to the normal sign-in screen.
- [ ] When an already-authenticated user opens an invitation, show the
      organization and role and require explicit acceptance before entering the
      workspace.

## Account and email follow-ups

- [ ] Connect provider-configurable transactional email for invitations, email
      verification, and password reset.
- [ ] Replace immediate unverified email changes with the verified email-change
      flow after transactional email is available.

## People Registry migration

- [x] Add the organization-scoped person and import-batch schema.
- [x] Build the read-only list, search, and type/status filters.
- [x] Run a no-PII dry-run report for the 9,072 core legacy person records.
- [x] Import core records only after source/import/issue counts reconcile.
- [x] Add the read-only core profile drawer and source-value review flags.
- [ ] Migrate beneficiary home and placement history.
- [ ] Migrate academic history after placement reconciliation.
