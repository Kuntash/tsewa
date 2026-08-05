# People Registry migration map

## Source

- Prepared legacy database: `data-migration/d1/tibethomes-newer-d1.sqlite`
- Source system: THF Office Manager
- This document contains aggregate findings only. Legacy person data must not be
  committed to the Tsewa repository.

## Core record counts

| Target kind | Legacy source |   Records | Legacy discriminator |
| ----------- | ------------- | --------: | -------------------- |
| Child       | `Beneficiary` |     8,064 | `type = 0`           |
| Elderly     | `Beneficiary` |       569 | `type = 1`           |
| Staff       | `Staff`       |       439 | n/a                  |
| **Total**   |               | **9,072** |                      |

The beneficiary table contains 8,633 populated, non-duplicated admission
numbers. Staff uses a separate `registration_no` field.

## First-pass identity mapping

| Tsewa field              | Beneficiary source         | Staff source               |
| ------------------------ | -------------------------- | -------------------------- |
| `kind`                   | `type`: 0 child, 1 elderly | constant `staff`           |
| `external_id`            | `id`                       | `id`                       |
| `admission_number`       | `admission_no`             | `registration_no`          |
| `display_name`           | `name`                     | `first_name` + `last_name` |
| `status`                 | 1 active, 2 inactive       | 1 active, 2 inactive       |
| `gender`                 | `gender`: 1 male, 2 female | `sex`: 1 male, 2 female    |
| `date_of_birth`          | `dob`                      | `dob`                      |
| `admission_or_joined_on` | `admin_dt`                 | `date_of_joining`          |
| `campus_or_location`     | `campus`                   | `place_allocated`          |
| `photo_asset_reference`  | `photo_asset_id`           | `photo_asset_id`           |

Every imported row must also carry `organization_id`, source system, source
table, source ID, import batch ID, and imported timestamp.

## Dependent legacy data

| Area                  | Legacy table       |   Rows |
| --------------------- | ------------------ | -----: |
| Academic history      | `BeneficiaryClass` | 25,427 |
| Home history          | `BeneficearyHome`  | 18,151 |
| Documents             | `Document`         | 18,836 |
| Sibling relationships | `SiblingDetails`   |  1,105 |
| Staff detail rows     | `StaffDetails`     |     30 |

These relationships should be imported after the core person mapping is stable.
No R2 assets are required for the first read-only registry pass.

## Data-quality gates

- Treat legacy dates as authoritative during migration, including suspicious or
  pre-1900 values. Preserve them exactly and surface them for correction in
  Tsewa instead of rewriting or dropping them during import.
- Preserve original values and IDs for reconciliation.
- Use idempotent upserts keyed by organization, source system, source table, and
  source ID.
- Produce a dry-run report containing counts and issue categories but no names,
  addresses, phone numbers, or other personal data.
- Compare source count, imported count, skipped count, and issue count before
  promoting a batch.

## First aggregate dry run

The aggregate-only report is committed at
`reports/people-registry-dry-run.json`. It contains no selected row values or
personal data. The prepared source was opened read-only and verified unchanged
after analysis.

| Gate                     | Result |
| ------------------------ | -----: |
| Expected core records    |  9,072 |
| Observed core records    |  9,072 |
| Identity-gate eligible   |  9,072 |
| Blocked records          |      0 |
| Blocking error instances |      0 |
| Warning instances        | 10,231 |
| Imported records         |      0 |

The warnings are non-blocking and can overlap on the same record:

- All 8,633 beneficiary `campus` values are blank, so location must remain
  empty in the core pass and be derived from later home/academic history.
- 1,379 beneficiary and 73 staff photo references are missing. R2 assets are
  outside the core pass.
- 74 beneficiary admission dates precede dates of birth. These values are
  retained as supplied so the organization can review and correct them later.
- One beneficiary admission date is missing and one is before 1900.
- 24 staff dates of birth and 46 staff joining dates are missing.

## Core import policy

- Import all 9,072 eligible core people into the Tsewa D1 only.
- Use deterministic person IDs and idempotent upserts keyed by organization,
  source system, source table, and source ID.
- Preserve legacy date text exactly. The legacy dataset remains the source of
  truth until an authorized user corrects a value in a later editable workflow.
- Resolve beneficiary nationality through the legacy `nationality` lookup.
- Leave unavailable campus/location and staff nationality values empty.
- Retain legacy photo asset references, but do not copy or modify R2 objects in
  this slice.
- Generate import SQL only in a permission-restricted temporary directory and
  remove it immediately after execution. Personal data must not be committed to
  this repository.

## Core import result

The controlled core import completed on 2026-08-05. Its aggregate-only
reconciliation report is committed at `reports/people-registry-import.json`.

| Reconciliation gate | Result |
| ------------------- | -----: |
| Source records      |  9,072 |
| Imported records    |  9,072 |
| Unique source links |  9,072 |
| Skipped records     |      0 |
| Children            |  8,064 |
| Elderly residents   |    569 |
| Staff               |    439 |

The target retained the source-quality aggregates exactly: 24 missing dates of
birth, 47 missing admission/joining dates, one pre-1900 date, 74 dates before
birth, 8,633 missing locations, and 1,452 missing photo references. No R2
objects were copied, and the original D1, R2 bucket, and prepared SQLite source
were not modified.

## Placement-history dry run

The aggregate-only placement report is committed at
`reports/placement-history-dry-run.json`. The prepared source was opened in
SQLite query-only mode and its SHA-256, size, and modification time were
verified unchanged after analysis.

| Gate                                      | Result |
| ----------------------------------------- | -----: |
| Legacy home-history rows                  | 18,151 |
| Eligible rows                             | 18,151 |
| Blocked rows                              |      0 |
| Beneficiaries with history                |  7,703 |
| Beneficiaries without history             |    930 |
| Derived current placements                |  7,703 |
| History rows with missing location lookup |     18 |

Current placement is derived deterministically from the latest parsed legacy
date, breaking same-date ties with the greatest source row ID. The home name is
retained as a readable fallback for the 18 rows whose legacy location lookup is
missing. All legacy dates remain authoritative: the single future-dated row and
78 rows predating admission are imported unchanged and surfaced for later
organizational review. The 95 same-person, same-date groups are retained in
full rather than collapsed.

## Placement import policy

- Import every `beneficeary_home` row into organization-scoped placement
  history with deterministic IDs and source provenance.
- Enforce at most one current placement for each organization/person pair.
- Update a beneficiary's registry location from the current placement,
  preferring the legacy location lookup and falling back to the home name.
- Keep staff placement history empty; staff work allocation remains on the core
  person record.
- Use idempotent upserts so a rerun produces the same 18,151 history rows and
  7,703 current placements.
- Do not copy or modify any R2 objects in this slice.

## Placement import result

The controlled placement import completed on 2026-08-05. Its aggregate-only
reconciliation is committed at `reports/placement-history-import.json`.

| Reconciliation gate             | Result |
| ------------------------------- | -----: |
| Source rows                     | 18,151 |
| Imported rows                   | 18,151 |
| Unique source links             | 18,151 |
| Skipped rows                    |      0 |
| People with history             |  7,703 |
| Current placements              |  7,703 |
| Orphaned placements             |      0 |
| Unreadable current placements   |      0 |
| Populated beneficiary locations |  7,703 |

The target retained all 18 missing location lookups and the single future-dated
row exactly as supplied. No R2 objects were copied. Post-import checks confirmed
that the original D1 had zero writes, the original R2 remained at 46,941
objects, and the prepared SQLite source fingerprint was unchanged.

## Academic-history dry run

The aggregate-only academic report is committed at
`reports/academic-history-dry-run.json`. The prepared source was opened in
SQLite query-only mode and verified unchanged after analysis.

| Gate                           | Result |
| ------------------------------ | -----: |
| Legacy academic-history rows   | 25,427 |
| Eligible rows                  | 25,427 |
| Blocked rows                   |      0 |
| Beneficiaries with history     |  7,982 |
| Beneficiaries without history  |    651 |
| Derived latest records         |  7,982 |
| Missing school lookups         |      1 |
| Maximum records for one person |     13 |

The latest academic record is derived deterministically from the latest parsed
legacy date, breaking same-date ties with the greatest source row ID. All 52
same-person, same-date groups and the 9 rows predating admission are retained in
full. The source contains 5,466 historical rows where the `school_house`
association no longer matches the row's school; the school and house lookups
are therefore preserved independently instead of rewriting either value.

## Academic import policy

- Import every `beneficiary_class` row with deterministic IDs, organization
  scope, and source provenance.
- Preserve class, school, house, academic session, source date, result,
  roll/board identifiers, and description exactly where supplied.
- Enforce at most one latest academic record for each organization/person pair.
- Keep the single missing school lookup nullable while retaining the rest of
  that academic row.
- Keep staff academic history empty because this legacy table is
  beneficiary-specific.
- Use idempotent upserts and do not copy or modify any R2 objects.

## Academic import result

The controlled academic-history import completed on 2026-08-06 local time.
Its aggregate-only reconciliation is committed at
`reports/academic-history-import.json`.

| Reconciliation gate        | Result |
| -------------------------- | -----: |
| Source rows                | 25,427 |
| Imported rows              | 25,427 |
| Unique source links        | 25,427 |
| Skipped rows               |      0 |
| People with history        |  7,982 |
| Latest academic records    |  7,982 |
| Orphaned academic records  |      0 |
| Maximum records per person |     13 |

The target retained the one missing school lookup, both populated result
values, and both populated descriptions exactly as supplied. The empty legacy
roll and board-registration fields remain empty. No R2 objects were copied;
the original D1, original R2, and prepared SQLite fingerprint were unchanged
after import.

## Delivery order

1. Organization-scoped person and import-batch schema.
2. Read-only People Registry list, search, and filters.
3. Dry-run importer for the 9,072 core records.
4. Controlled core-record import. **Completed.**
5. Read-only core profile drawer with source provenance and date-review flags.
   **Completed.**
6. Beneficiary home and placement-history migration. **Completed.**
7. Beneficiary academic-history migration. **Completed.**
8. Sibling, staff-detail, document, and R2 asset migrations.
