---
type: "query"
date: "2026-08-10T22:54:05.576586+00:00"
question: "can't we make the media transfer faster? like no need for doing it one by one is there? second in search, I believe there is no debounce therefore what happens is api keeps getting called but cancelled and aborted by tanstack probably, can we just debounce? also add in the TODO.md that we have to fix theming, making all search url first and derive from url safely."
contributor: "graphify"
outcome: "useful"
source_nodes: ["people-registry.tsx", "school-operations.tsx", "progressReportPath", "TODO.md"]
---

# Q: can't we make the media transfer faster? like no need for doing it one by one is there? second in search, I believe there is no debounce therefore what happens is api keeps getting called but cancelled and aborted by tanstack probably, can we just debounce? also add in the TODO.md that we have to fix theming, making all search url first and derive from url safely.

## Answer

Expanded from original query via vocab: [file, media, transfer, worker, search, query, people, school, url]. The bulk importer now transfers 12 files concurrently, checks source byte size and SHA-256, relies on successful R2 upload, and defers the redundant target re-download to a final reconciliation. Measured throughput rose from about 14-17 to about 79 files per minute. People and Students API searches now use a 300 ms debounce; local class filtering stays immediate. TODO.md records theme consistency and validated URL-first search state.

## Outcome

- Signal: useful

## Source Nodes

- people-registry.tsx
- school-operations.tsx
- progressReportPath
- TODO.md