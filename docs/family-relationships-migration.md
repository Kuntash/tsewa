# Family and relationship migration

This slice migrates beneficiary family context and sibling links from the prepared
THF Office Manager SQLite source. It does not require SQL Server or Docker.

## Source tables

- `beneficiary` supplies parentage, parent, guardian, spouse, and household fields.
- `parantage` supplies the legacy parentage label.
- `sibling_details` supplies directional beneficiary-to-beneficiary sibling links.

The source database is always opened read-only and fingerprinted before and after
each operation. Reports contain aggregate counts only and no selected personal
values.

## Local workflow

```bash
vp run db:migrate:local
vp run migration:family:dry-run
vp run migration:family:import -- \
  --target local \
  --organization-slug tibetan-homes-foundation \
  --confirm-database-id f6dc8a9f-5eb3-4ae7-b9f1-88645634a608
```

The import is deterministic and safe to rerun. Family profiles are upserted by
their legacy beneficiary source ID; sibling relationships are upserted by their
legacy `sibling_details` source ID.

Self-references and duplicate directional links are retained as source truth and
receive a review flag. They are never silently discarded or repaired.

## Remote gate

Do not apply migration `0007` or import personal data remotely until the local
counts, profile API, and UI have been verified. The remote command requires the
exact D1 database ID as an explicit guard.

## Deployment record

Local verification and the guarded production import completed on 5 August 2026. The remote D1 reconciliation matched the dry run: 8,593 family profiles,
1,105 sibling relationships, and 12 retained review flags. The aggregate-only
record is stored in `reports/family-relationships-import.json`.

## Editing policy

Authorized owners, administrators, and staff can edit imported family details.
The family profile keeps its original source system, table, and ID, while the
audit log records which fields changed.

Sibling links are reciprocal in the application: one stored link appears on
both profiles. New duplicate and self-links are rejected. Removing a link marks
all matching source rows inactive instead of deleting them, so imported history
and review flags remain available.
