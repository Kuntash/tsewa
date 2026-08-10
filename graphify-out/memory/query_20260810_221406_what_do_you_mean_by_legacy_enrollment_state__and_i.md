---
type: "query"
date: "2026-08-10T22:14:06.870388+00:00"
question: "what do you mean by legacy enrollment state? and I believe you said some 2,043 rows are present in the academic rows? also what do you mean by enrollment lifecycle? was it there in the old flow? why do we need it now?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["student_enrollment", "person_academic_record", "student-enrollment-dry-run.mjs", "EnrollmentStatusBadge"]
---

# Q: what do you mean by legacy enrollment state? and I believe you said some 2,043 rows are present in the academic rows? also what do you mean by enrollment lifecycle? was it there in the old flow? why do we need it now?

## Answer

Expanded from original query via graph vocab: [academic, class, completed, enrollment, history, legacy, lifecycle, session, status, student]. Legacy enrollment state means the imported source proves only that a BeneficiaryClass allocation row was recorded; it does not prove enrolled, transferred, withdrawn, completed, or graduated status. All 25,427 source rows remain in person_academic_record. The canonical student_enrollment table selects one latest row per person/session, yielding 23,384 enrollments; the remaining 2,043 are retained superseded versions across 1,889 multi-row person/session groups. Legacy ASP.NET inserted BeneficiaryClass rows, had an update method explicitly marked not in use with its update call commented out, allowed deletion, and used SelectBeneficiaryClassMax for current display. The source table has no lifecycle-status field. Lifecycle states are therefore a future Tsewa workflow concept, useful for writable transfers, withdrawals, completion, and roster/attendance scoping, but not required for the present read-only import; all imported records use the neutral recorded status with legacy_allocation provenance.

## Outcome

- Signal: useful

## Source Nodes

- student_enrollment
- person_academic_record
- student-enrollment-dry-run.mjs
- EnrollmentStatusBadge