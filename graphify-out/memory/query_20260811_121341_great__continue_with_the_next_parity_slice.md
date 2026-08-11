---
type: "implementation"
date: "2026-08-11T12:13:41.165805+00:00"
question: "great, continue with the next parity slice?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["school_master", "school-operations.tsx", "auditStatement", "organization"]
---

# Q: great, continue with the next parity slice?

## Answer

Expanded from original query via graph vocab: [school, class, section, house, master, edit, create, location, operations, organization, audit]. The next recommended parity slice is school/class/house master-data editing. Implemented the first complete part: organization-scoped school creation and editing for name, location, affiliation number, and active status, with role checks, same-origin mutation checks, duplicate-name protection, preserved legacy source identifiers, and audit events. Added responsive school-directory actions and an editor sheet. Practice-organization tests passed for create, edit, and duplicate rejection; temporary test data was removed. No THS record was changed.

## Outcome

- Signal: useful

## Source Nodes

- school_master
- school-operations.tsx
- auditStatement
- organization