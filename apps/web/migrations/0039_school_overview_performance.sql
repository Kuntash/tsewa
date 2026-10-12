-- Session-wide student counts only need each enrolment's person, so let them read
-- one session from a covering index instead of every enrolment the organisation has.
CREATE INDEX IF NOT EXISTS student_enrollment_session_person_idx
  ON student_enrollment (organization_id, academic_session_id, person_id);
CREATE INDEX IF NOT EXISTS sponsorship_assignment_session_idx
  ON sponsorship_assignment (organization_id, academic_session_id);
PRAGMA optimize;
