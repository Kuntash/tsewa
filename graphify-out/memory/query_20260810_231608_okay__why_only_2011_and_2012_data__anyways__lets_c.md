---
type: "query"
date: "2026-08-10T23:16:08.132388+00:00"
question: "okay, why only 2011 and 2012 data? anyways, lets continue and do that."
contributor: "graphify"
outcome: "useful"
source_nodes: ["school_operations.tsx", "student_enrollment", "academic_session"]
---

# Q: okay, why only 2011 and 2012 data? anyways, lets continue and do that.

## Answer

Expanded from original query via vocab: [school, student, class, enrollment, session, result, workflow]. The legacy source itself contains all 311 mark sheets only in sessions 2011 and 2012, while sessions 2013-2026 have zero result setup and zero marks; this was not an import filter. Implemented a read-only historical results slice with organization-scoped D1 tables, aggregate-only dry run, idempotent import, authenticated APIs, a year/filter/search/pagination UI, and responsive result cards. Imported 95 subjects, 2 terms, 20 assessments, 311 mark sheets, and 17,821 results to the separate self-hosted D1 while preserving source assignments.

## Outcome

- Signal: useful

## Source Nodes

- school_operations.tsx
- student_enrollment
- academic_session