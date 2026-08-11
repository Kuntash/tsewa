---
type: "implementation"
date: "2026-08-11T11:59:50.535622+00:00"
question: "Remove redundant profile edit controls, add document and photo upload, naming, replacement and removal, and verify whether R2 migration is complete"
contributor: "graphify"
outcome: "useful"
source_nodes: ["apps/web/src/components/person-profile-sheet.tsx", "apps/web/src/server.ts", "apps/web/migrations/0016_person_file_editing.sql", "scripts/import-person-files.mjs", "scripts/lib/person-files.mjs"]
---

# Q: Remove redundant profile edit controls, add document and photo upload, naming, replacement and removal, and verify whether R2 migration is complete

## Answer

Removed the profile-wide edit controls and placed personal-detail editing in the Identity section. Added organization-scoped, permission-checked upload, rename, replace and remove flows backed by D1 audit metadata and R2 objects, with a 25 MB limit and safe photo/document MIME types. Verified locally on the practice student: create 201, rename/replace/remove 200, replacement download content correct, zero active files afterward. Reconciled production migration: target R2 46,938 objects, D1 46,938 rows / 17,397,012,993 bytes / 7,680 people, matching the eligible manifest; one source document row had no asset and three source bucket objects were outside the referenced eligible set.

## Outcome

- Signal: useful

## Source Nodes

- apps/web/src/components/person-profile-sheet.tsx
- apps/web/src/server.ts
- apps/web/migrations/0016_person_file_editing.sql
- scripts/import-person-files.mjs
- scripts/lib/person-files.mjs