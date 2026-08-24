---
type: "query"
date: "2026-08-21T11:12:12.947855+00:00"
question: "lets do some performance optimization now, find all the lagging apis and fix those and improve their performance"
contributor: "graphify"
outcome: "useful"
source_nodes: ["api-handlers.ts", "getMembershipContext()", "getSponsorshipRecords()", "Database"]
---

# Q: lets do some performance optimization now, find all the lagging apis and fix those and improve their performance

## Answer

Optimized authenticated API membership and permission lookup into one indexed Drizzle query; batched sponsorship summaries and organization settings reads; stopped sponsorship setup refetches on every filter change; batched access-role writes; added Server-Timing headers. Query-plan inspection confirmed existing indexes cover the new shared lookup.

## Outcome

- Signal: useful

## Source Nodes

- api-handlers.ts
- getMembershipContext()
- getSponsorshipRecords()
- Database