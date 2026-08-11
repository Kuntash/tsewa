# Tsewa TODO

The v0 scope and legacy database usage evidence are tracked in
[`docs/feature-parity.md`](docs/feature-parity.md). Update that checklist when a
feature ships or THF confirms that a historical workflow is still needed.

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

## Product foundations

- [ ] Fix theme consistency across every page, component, and interaction state.
- [ ] Make every search URL-first, validate URL parameters, and derive search,
      filter, sort, and page state safely from the URL.

## People Registry migration

- [x] Add the organization-scoped person and import-batch schema.
- [x] Build the read-only list, search, and type/status filters.
- [x] Run a no-PII dry-run report for the 9,072 core legacy person records.
- [x] Import core records only after source/import/issue counts reconcile.
- [x] Add the read-only core profile drawer and source-value review flags.
- [x] Migrate beneficiary home and placement history.
- [x] Migrate academic history after placement reconciliation.
- [x] Add read-only parents, guardians, household context, and sibling relationships.

## Documents and media migration

- [x] Reconcile all legacy document and photo metadata without generic-image filtering.
- [x] Add authenticated, streamed document and photo delivery.
- [x] Run a one-person D1/R2 pilot before bulk migration.
- [x] Review the pilot in production before migrating the remaining files.
- [x] Complete the resumable bulk file migration (46,938 files, zero reported
      failures).
- [x] Reconcile the completed bulk upload: target R2 contains all 46,938 eligible
      objects; D1 contains the same 46,938 rows and 17,397,012,993 bytes, with
      each upload SHA-256 checked by the migration worker.

## School Operations

- [x] Reconcile legacy sessions, school/class/house masters, and academic allocations.
- [x] Import the THS calendar-year session catalog and correct the seeded 2026 session.
- [x] Add the persisted inline academic-session switcher to the application header.
- [x] Build the read-only session overview and student allocation list.
- [x] Link student allocations back to the existing People Registry profile.
- [x] Reconcile one canonical student enrollment per person and session without
      discarding the superseded source rows.
- [x] Add read-only school directories and observed class rosters.
- [x] Add an isolated practice organization, school, class, and student for testing edits.
- [x] Add the first editable workflow: a new admission creates the person, current
      enrollment, change history, and audit record together.
- [ ] Confirm enrollment lifecycle meanings with THS before enabling transfer,
      withdrawal, completion, or promotion workflows on THS records.
- [x] Add simple actions for changing placement, transferring, withdrawing, and
      completing a student, backed by the enrollment change history.
- [ ] Confirm bulk promotion with THF before implementation; the legacy database
      contains only two populated promotion rows, both from 2011.
- [ ] If confirmed, add promotion with a preview, exceptions, and one-step rollback.
- [ ] Treat standalone attendance as a new feature, not a parity requirement; no
      legacy attendance-entry workflow or table was found.
- [ ] Add assessments, marks, results, and promotion.
