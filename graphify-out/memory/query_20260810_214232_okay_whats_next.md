---
type: "query"
date: "2026-08-10T21:42:32.470861+00:00"
question: "Okay whats next?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["school-operations.tsx", "person_academic_record", "TODO.md", "school_operations_import_batch"]
---

# Q: Okay whats next?

## Answer

Expanded from graph vocabulary: [school, operations, academic, session, student, class, result, record, import, migration, todo]. The recommended next vertical slice is session enrollment and class rosters. The current School Operations view reads legacy person_academic_record allocations, so a session-specific enrollment lifecycle should be introduced before marks, attendance, promotion, or other workflows. Build it in stages: reconcile legacy enrollment meanings and duplicates, add organization/session-scoped enrollment status and dates, import read-only, expose school/class rosters and movement history, verify with THS, then enable carefully audited writes. The bulk media migration can continue in parallel, with production D1 changes deployed only at safe checkpoints.

## Outcome

- Signal: useful

## Source Nodes

- school-operations.tsx
- person_academic_record
- TODO.md
- school_operations_import_batch