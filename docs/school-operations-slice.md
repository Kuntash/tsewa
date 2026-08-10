# School Operations vertical slice

## Academic-session behavior

An academic session is a user's persisted working context, not an authentication
or authorization boundary. Organization membership remains the security boundary.

The selected session should scope:

- student allocation by school, class, section, house, and roll number;
- assessments, marks, results, and promotion;
- School Operations dashboards and session-based reports.

It should not hide or change People Registry identity, family, placement history,
files, organization administration, or account settings. Those records belong to
the organization across sessions.

Today the login selection only writes `user_preference.active_academic_session_id`.
No People Registry query reads it, and the launchpad header is hard-coded. Setup
creates one `2026–27` session, which is why the selector has one option.

The THS legacy source uses calendar-year sessions. It contains session masters
from 2011 through 2026 with January-to-December boundaries. Before enabling School
Operations, the THS session catalog should be imported and the seeded `2026–27`
assumption corrected to `2026`. Other organizations remain free to use academic
years such as `2026–27` when that matches their calendar.

Keep the login selector for now, as previously decided. School Operations will
also provide an inline selector in the application header; changing it updates
the same per-user preference and refreshes only session-scoped views.

## Slice 1: read-only students

The first releasable slice is deliberately narrow:

1. Import the organization-scoped legacy session catalog and school/class/house
   masters with deterministic source provenance.
2. Add a session-scoped School Operations overview showing student, school,
   class, and house counts.
3. Add a searchable student allocation list with school, class, house, roll
   number, result, and status.
4. Open the existing People Registry profile for identity, family, history, and
   documents rather than duplicating those views.
5. Preserve every academic-history row. For a student's allocation inside one
   session, select the latest source date and break same-date ties using the
   greatest source row ID.

No create, edit, marks, result publication, or promotion workflow belongs in
this first slice. Those become later vertical slices after the imported read-only
view has been reconciled with THS.

## API boundary

All endpoints must validate organization membership and the requested session:

- `GET /api/school-operations/overview?sessionId=...`
- `GET /api/school-operations/students?sessionId=...&query=...&school=...&class=...&house=...`

The session ID is explicit in each request. The server must verify that it belongs
to the current member's organization; it must not trust the stored preference as
authorization. Responses remain read-only and organization scoped.

## Migration sequencing

Preparation and local validation can happen while the person-file transfer runs.
Do not apply the School Operations D1 migration remotely until that transfer has
finished, so two production migration processes do not compete for the same D1
database. The source inspection is read-only and aggregate-only.
