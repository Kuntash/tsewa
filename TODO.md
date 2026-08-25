# Tsewa TODO

The v0 scope and legacy database usage evidence are tracked in
[`docs/feature-parity.md`](docs/feature-parity.md). Update that checklist when a
feature ships or THF confirms that a historical workflow is still needed.

## Invitation UX follow-ups

- [x] Show a dedicated invalid, expired, revoked, or already-used invitation
      screen instead of falling back to the normal sign-in screen.
- [x] When an already-authenticated user opens an invitation, show the
      organization and role and require explicit acceptance before entering the
      workspace.

## Account and email follow-ups

- [x] Connect provider-configurable transactional email for invitations and
      password reset.
- [x] Add email verification delivery and a verified-email onboarding state.
- [x] Replace immediate unverified email changes with the verified email-change
      flow after transactional email is available.

## Product foundations

- [ ] Fix theme consistency across every page, component, and interaction state.
- [x] Increase the THS organization logo size on the anonymous `ths.kunga.dev`
      landing and sign-in page.
- [x] Build the `gettsewa.com` marketing and pricing site around the hosted product.
      Keep customer-managed deployment and enhanced data controls out of primary
      landing-page copy; mention them in the FAQ as Enterprise-tier options.
- [x] Add public privacy, terms, security, and data-processing pages plus favicon,
      social-sharing assets, sitemap, robots rules, structured data, and AI-readable
      `llms.txt` discovery files.
- [ ] Configure Dodo Payments test products and implement organisation-level hosted
      subscriptions after validating the launch pricing hypothesis.
- [x] Add privacy-reviewed, cookieless PostHog events to the public marketing funnel
      with autocapture, replay, persistent identity, and sensitive URL data disabled.
- [ ] Create the production PostHog EU project, provide its public project key at
      marketing build time, validate live events, and connect its MCP read-only.
- [ ] Add privacy-reviewed PostHog events for hosted activation; keep autocapture and
      session replay disabled in the hosted application.
- [x] Persist the user's theme preference across browser sessions.
- [x] Make every persistent page search URL-first, validate URL parameters, and derive search,
      filter, sort, and page state safely from the URL.

## Staff operations

- [x] Add a URL-first, organization-scoped staff employment directory.
- [x] Preserve legacy departments, designations, categories, contact details,
      and recorded employment events through an additive Drizzle migration.
- [x] Allow permission-checked, audited editing of employment and contact details.
- [ ] Add staff dependants, qualifications, experience, and transfer workflows.
- [ ] Add staff leave and extra-duty workflows.

## People Registry migration

- [x] Add the organization-scoped person and import-batch schema.
- [x] Build the read-only list, search, and type/status filters.
- [x] Run a no-PII dry-run report for the 9,072 core legacy person records.
- [x] Import core records only after source/import/issue counts reconcile.
- [x] Add the read-only core profile drawer and source-value review flags.
- [x] Migrate beneficiary home and placement history.
- [x] Migrate academic history after placement reconciliation.
- [x] Add read-only parents, guardians, household context, and sibling relationships.
- [x] Resolve the duplicate School History and Earlier School Records sections,
      consolidating them if they represent the same information.
- [x] Add inputs for education number, registration certificate number (RC), and
      identity certificate number (IC) to each applicable person record.

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
- [x] Make media and document saving behave consistently with saving in other
      sections.

## School Operations

- [x] Reconcile legacy sessions, school/class/house masters, and academic allocations.
- [x] Import the THS calendar-year session catalog and correct the seeded 2026 session.
- [x] Add the persisted inline academic-session switcher to the application header.
- [x] Build the read-only session overview and student allocation list.
- [x] Link student allocations back to the existing People Registry profile.
- [x] Reconcile one canonical student enrollment per person and session without
      discarding the superseded source rows.
- [x] Add read-only school directories and observed class rosters.
- [x] Retire the temporary practice organization after the write workflows were validated.
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
- [x] Align the Change placement button horizontally with the Placement title,
      matching the layout used in other sections.
- [x] Fix the THS 2026 school-dashboard student list/profile mismatch: the People
      dashboard shows correct student data and printing works, but opening a
      profile from the school dashboard can show `legacy_allocation` and
      "enrollment not found."
- [x] Fix the Marks and Result page crash that shows "Something went wrong" due
      to calling `toLowerCase()` on an undefined value.
