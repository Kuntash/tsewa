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

The login selection writes `user_preference.active_academic_session_id`. People
Registry remains organization-wide, while School Operations reads the preference
as its initial working session. The same preference can now be changed inline.

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

## Slice 2: session enrollments and class rosters

The second slice gives the reconciled allocation an explicit home in the domain
model. `student_enrollment` contains one canonical record for a person in an
academic session, while every original row remains available in
`person_academic_record`. `school_class_offering` represents the school/class
combinations observed in each session.

The legacy source does not contain a reliable enrollment lifecycle field. For
that reason, imported records use `recorded` with the source
`legacy_allocation`; the UI labels this as **Imported** and shows the person's
present-day registry status separately. It does not infer that a student was
enrolled, withdrawn, completed, or graduated in a historical year. When an
authorized user changes that enrollment, Tsewa records the explicit status and
change history while preserving the imported source references.

Reconciliation found:

- 25,427 original academic-allocation rows;
- 23,384 canonical person/session enrollments;
- 2,043 superseded allocation rows retained in academic history;
- 1,026 observed school/class/session offerings;
- 6,343 selected rows whose source-recorded date falls outside the session
  boundary, preserved as source-authoritative for later THS cleanup;
- no missing person, session, class, school-house, or house references, and one
  selected enrollment whose source school is unmapped.

The UI provides the organization school directory and session class rosters.
Opening a school or roster applies stable master-record IDs to the student list,
so duplicate source names remain distinguishable.

## API boundary

All endpoints must validate organization membership and the requested session:

- `GET /api/school-operations/overview?sessionId=...`
- `GET /api/school-operations/students?sessionId=...&q=...&school=...&class=...&house=...`
- `GET /api/school-operations/schools?sessionId=...`
- `GET /api/school-operations/rosters?sessionId=...`

The session ID is explicit in each request. The server must verify that it belongs
to the current member's organization; it must not trust the stored preference as
authorization. Reads and writes remain organization scoped, and writes require
an owner, administrator, or staff role.

## Import result

The production import completed on 2026-08-11 after pausing the resumable
person-file transfer at a committed checkpoint. It imported 16 sessions, 9
schools, 88 class masters, 6 houses, and 40 school-house links. All 25,427
academic-history rows were retained. The seeded session was corrected in place,
so saved user preferences remained valid.

The source was opened read-only and its SHA-256 was verified before and after the
import. The aggregate-only result is recorded in
`reports/school-operations-import.json`. The person-file transfer was resumed
after the D1 migration and application deployment.

The session-enrollment production import completed on 2026-08-11. Its
aggregate-only result is recorded in `reports/student-enrollment-import.json`;
the corresponding reconciliation is in
`reports/student-enrollment-dry-run.json`.
