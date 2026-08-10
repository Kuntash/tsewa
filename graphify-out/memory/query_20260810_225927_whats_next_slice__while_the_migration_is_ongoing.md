---
type: "query"
date: "2026-08-10T22:59:27.991445+00:00"
question: "whats next slice? while the migration is ongoing?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["TODO.md", "student_enrollment", "school-operations.tsx", "person_academic_record"]
---

# Q: whats next slice? while the migration is ongoing?

## Answer

Expanded from original query via vocab: [school, student, class, enrollment, session, result, workflow, todo]. Recommended next slice: read-only Subjects and Historical Results. The source has 95 subjects, 2 terms, 20 assessments, 4,414 class-subject-assessment rows, 311 mark sheets, and 17,821 student mark entries, with no orphan mark, student, or assessment links. Marks exist only for 2011 and 2012, so the UI must clearly present them as history rather than current 2026 results. This slice is D1-only and independent of the running R2 migration. Attendance should wait because no legacy attendance table was found and enrollment lifecycle meanings remain unconfirmed.

## Outcome

- Signal: useful

## Source Nodes

- TODO.md
- student_enrollment
- school-operations.tsx
- person_academic_record