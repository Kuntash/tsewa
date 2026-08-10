---
type: "query"
date: "2026-08-10T22:23:00.544592+00:00"
question: "How can I view media transfer progress, why do class masters show legacy number suffixes, and why is the product copy complex? Do we need the Legacy recorded column?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["progressReportPath", "student_enrollment", "academic_class_master", "EnrollmentStatusBadge", "RosterRow"]
---

# Q: How can I view media transfer progress, why do class masters show legacy number suffixes, and why is the product copy complex? Do we need the Legacy recorded column?

## Answer

Expanded via graph vocab: [class, enrollment, legacy, master, progress, record, roster, status, student, transfer]. The live media importer writes aggregate progress to reports/person-files-bulk-import.json every 50 files; it is currently alive and the report can be read with jq. The class number shown in the UI is an internal legacy source ID added to distinguish duplicate source master rows. The source has 88 class rows but only 76 display names: 20 rows belong to 8 duplicate-name groups. Some are true duplicates such as VII A IDs 12 and 126; others hide meaningful sections, such as XI Arts A/D/E. Internal IDs should not appear in normal UI. Canonical class records plus source-alias mapping is the proper fix; the UI should show useful section names. All 23,384 imported student_enrollment rows have recorded/legacy_allocation, so there is no non-legacy data point and the enrollment-status column has no current user value. Remove it from the visible table while retaining provenance internally. Product copy currently leaks engineering and migration language; simplify labels and move import details to an admin data-review area.

## Outcome

- Signal: useful

## Source Nodes

- progressReportPath
- student_enrollment
- academic_class_master
- EnrollmentStatusBadge
- RosterRow