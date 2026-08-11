---
type: "bugfix"
date: "2026-08-11T12:05:08.830997+00:00"
question: "Why are Save name, Replace, and Remove disabled on legacy data? They should be editable; test only in the other organization."
contributor: "graphify"
outcome: "useful"
source_nodes: ["apps/web/src/components/person-profile-sheet.tsx", "apps/web/src/server.ts"]
---

# Q: Why are Save name, Replace, and Remove disabled on legacy data? They should be editable; test only in the other organization.

## Answer

There was no legacy-data restriction in the API. The UI disabled Save name until the label changed and Replace until a file was selected, making migrated rows appear locked. Changed both buttons to remain active and provide clear missing-input guidance; Remove remains active. Verified in the local practice organization using a file marked with legacy source metadata: all three buttons disabled=false/opacity=1/cursor=pointer; rename, replace, authenticated replacement download, and remove all returned 200, with no remaining active test file. No THS record was changed.

## Outcome

- Signal: useful

## Source Nodes

- apps/web/src/components/person-profile-sheet.tsx
- apps/web/src/server.ts