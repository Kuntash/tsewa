---
type: "query"
date: "2026-08-21T10:08:13.774038+00:00"
question: "continue until you are done with all drizzle migration"
contributor: "graphify"
outcome: "useful"
source_nodes: ["api-handlers.ts", "runtime-env.ts", "query.ts"]
---

# Q: continue until you are done with all drizzle migration

## Answer

Completed the typed Drizzle runtime migration end-to-end: migrated the remaining school, scholarship, sponsorship, people, academic results, and health read paths; removed all legacy .prepare() calls; deleted QueryDatabase and apps/web/src/db/query.ts; verified zero compatibility references, clean typecheck/lint, 10 passing tests, and a successful production build. Production data and deployment were not touched.

## Outcome

- Signal: useful

## Source Nodes

- api-handlers.ts
- runtime-env.ts
- query.ts