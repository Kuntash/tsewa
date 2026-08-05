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
| `gender`                 | 1 male, 2 female           | 1 male, 2 female           |
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

- Quarantine dates outside an agreed range rather than coercing them. The legacy
  admission data contains at least one `1899-12-30` sentinel value.
- Preserve original values and IDs for reconciliation.
- Use idempotent upserts keyed by organization, source system, source table, and
  source ID.
- Produce a dry-run report containing counts and issue categories but no names,
  addresses, phone numbers, or other personal data.
- Compare source count, imported count, skipped count, and issue count before
  promoting a batch.

## Delivery order

1. Organization-scoped person and import-batch schema.
2. Read-only People Registry list, search, and filters.
3. Dry-run importer for the 9,072 core records.
4. Controlled core-record import.
5. Profile drawer and type-specific details.
6. Academic, home, sibling, staff-detail, document, and R2 asset migrations.
