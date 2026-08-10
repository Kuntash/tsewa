---
type: "query"
date: "2026-08-10T21:40:45.944752+00:00"
question: "So how does a session work? Like if I select 2026, will it show only students that registered this year or all active students of that year?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["person_academic_record", "person", "AcademicSession", "SchoolOperations"]
---

# Q: So how does a session work? Like if I select 2026, will it show only students that registered this year or all active students of that year?

## Answer

Expanded from original query via graph vocab: [session, academic, student, active, status, person, record, school]. Selecting 2026 shows every person with at least one academic allocation record whose academic_session is 2026. It does not filter by the year the person first registered. If multiple 2026 records exist, the latest source-dated allocation is displayed. The default includes both currently active and currently inactive people; the active label comes from the current person status, not a historical as-of-2026 status. A person with no 2026 academic record is absent even if currently active.

## Outcome

- Signal: useful

## Source Nodes

- person_academic_record
- person
- AcademicSession
- SchoolOperations