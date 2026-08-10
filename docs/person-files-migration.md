# Person files migration

This slice migrates private person photos, family/guardian photos, and document
metadata from the verified THF Office Manager export. The legacy D1 and R2
resources are read-only sources; the self-hosted instance receives its own D1
metadata and R2 objects.

## Preservation policy

- Every referenced asset is eligible.
- Generic or placeholder images are not detected, classified, or removed.
- Object bytes are streamed between R2 buckets and hashed during transfer, so a
  local 17 GB asset copy is not created.
- D1 metadata is written only after every selected target object passes byte-size
  and SHA-256 verification.
- Temporary SQL containing file labels is mode `0600` and removed after import.

## Dry run

```bash
vp run migration:files:dry-run
```

The committed report is aggregate-only and contains no selected names, IDs,
file names, object keys, or other personal data.

## One-person pilot

Apply migration `0008`, then explicitly select one legacy identifier and confirm
the expected number of files, D1 database ID, and both R2 bucket names:

```bash
vp run migration:files:import -- \
  --target local \
  --identifier 7428 \
  --expected-file-count 11 \
  --organization-slug tibetan-homes-foundation \
  --confirm-database-id f6dc8a9f-5eb3-4ae7-b9f1-88645634a608 \
  --source-bucket tibetan-homes \
  --target-bucket tsewa-self-hosted-files
```

The import is deterministic and safe to rerun. Target object keys use the
organization slug, deterministic person UUID, and legacy asset ID; they do not
expose a person's name or admission number.

The local and production pilots completed on 10 August 2026 with one person,
11 files, and 3,468,686 bytes. All source and target object hashes matched. The
aggregate-only record is stored in `reports/person-files-pilot-import.json`.

## Resumable bulk import

After approving the pilot, migrate all remaining records with the reviewed
aggregate counts as explicit safety gates:

```bash
vp run migration:files:bulk -- \
  --target remote \
  --scope all \
  --expected-file-count 46938 \
  --expected-byte-count 17397012993 \
  --expected-people-count 7680 \
  --organization-slug tibetan-homes-foundation \
  --confirm-database-id f6dc8a9f-5eb3-4ae7-b9f1-88645634a608 \
  --source-bucket tibetan-homes \
  --target-bucket tsewa-self-hosted-files \
  --concurrency 4 \
  --chunk-size 50
```

The importer reads completed source asset IDs and hashes from the target D1
before starting. Matching completed records are skipped, while any metadata
mismatch stops the run. Each chunk is recorded in D1 only after every object in
that chunk has passed source and target SHA-256 and byte-size verification. An
interrupted run can therefore be resumed with the same command. Progress is
written to `reports/person-files-bulk-import.json` using aggregate counts only.

## Access control

Files are served only through `/api/files/:id`. The Worker verifies the current
user's organization membership, scopes the D1 lookup to that organization, and
streams the private R2 body without buffering it in Worker memory.
