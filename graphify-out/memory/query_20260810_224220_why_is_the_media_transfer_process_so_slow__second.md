---
type: "query"
date: "2026-08-10T22:42:20.141162+00:00"
question: "why is the media transfer process so slow? second can't we merge the class data and reconcile? because class data is supposed to be master data no? also do the product-copy sweep across the entire application."
contributor: "graphify"
outcome: "useful"
source_nodes: ["academic_class_master", "student_enrollment", "SchoolOperations"]
---

# Q: why is the media transfer process so slow? second can't we merge the class data and reconcile? because class data is supposed to be master data no? also do the product-copy sweep across the entire application.

## Answer

Expanded from original query via vocab: [class, enrollment, master, progress, record, student, transfer]. Media relay is slow because every file uses separate Wrangler source GET, target PUT, and target GET verification processes, with D1 committed in 50-file chunks. Class source aliases can be reconciled without deleting history: 88 source rows map to 78 visible classes, and 2026 offerings map from 70 to 68. Daily UI copy now uses short task-focused terms and hides import-only details.

## Outcome

- Signal: useful

## Source Nodes

- academic_class_master
- student_enrollment
- SchoolOperations