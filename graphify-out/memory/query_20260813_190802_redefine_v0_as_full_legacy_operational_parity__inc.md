---
type: "query"
date: "2026-08-13T19:08:02.700701+00:00"
question: "Redefine v0 as full legacy operational parity; include database-backed features, RBAC, and Everlittle-style email invitations"
contributor: "graphify"
outcome: "corrected"
correction: "v0 means full database-evidenced legacy operational parity, not only current-workflow pilot readiness"
source_nodes: ["Legacy feature parity", "organization_member", "Invitation", "MembershipContext", "form_rights"]
---

# Q: Redefine v0 as full legacy operational parity; include database-backed features, RBAC, and Everlittle-style email invitations

## Answer

Expanded from Tsewa graph vocabulary: [parity, legacy, feature, database, used, usage, role, access, invitation, email, membership, organization]. Correction: the prior v0 status used pilot-readiness rather than full operational parity. Under the product owner's rule, any legacy workflow supported by populated operational data belongs before v0; recency affects sequencing, not inclusion. The source has 122 application tables, 108 non-empty. Remaining v0 domains include sponsorship, scholarship, dispensary/health, staff/leave/holiday/ledger, and editable academic configuration/marks/results as supported by their populated tables. Empty tables alone do not create parity scope, while a module remains in scope if related operational tables are populated. RBAC is itself evidenced by 6 modules, 102 forms, 303 form rights, 13 roles, 1,504 role-right assignments, 3,143 per-user right assignments across 32 users, and add/edit/delete/save/verify actions. Tsewa currently has owner/admin/staff/viewer but staff receives broad mutation access through canManageSchool, so it lacks module/action permissions. Recommended next engineering slice: access-control and invitation foundation with server-enforced domain/action permissions, role presets and assignments, safe migration of current memberships, audit coverage, and Everlittle-style Cloudflare Email Sending invitation delivery with sent/failed metadata, rate limits, token-rotating resend, expiry/revocation/acceptance states, and explicit signed-in acceptance. Then execute the revised evidence-backed parity module backlog before declaring v0.

## Outcome

- Signal: corrected
- Correction: v0 means full database-evidenced legacy operational parity, not only current-workflow pilot readiness

## Source Nodes

- Legacy feature parity
- organization_member
- Invitation
- MembershipContext
- form_rights