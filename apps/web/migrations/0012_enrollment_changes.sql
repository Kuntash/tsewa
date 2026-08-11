PRAGMA foreign_keys = ON;

-- Keep a plain-language history of every enrollment change. The enrollment row
-- stores the student's current position in a session; this table preserves what
-- changed, when it changed, and who changed it.
CREATE TABLE IF NOT EXISTS student_enrollment_change (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  enrollment_id TEXT NOT NULL REFERENCES student_enrollment(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  academic_session_id TEXT NOT NULL REFERENCES academic_session(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL
    CHECK (change_type IN (
      'admitted', 'placement_changed', 'transferred', 'withdrawn', 'completed', 'promoted'
    )),
  effective_on TEXT NOT NULL,
  from_school_id TEXT REFERENCES school_master(id) ON DELETE RESTRICT,
  to_school_id TEXT REFERENCES school_master(id) ON DELETE RESTRICT,
  from_academic_class_id TEXT REFERENCES academic_class_master(id) ON DELETE RESTRICT,
  to_academic_class_id TEXT REFERENCES academic_class_master(id) ON DELETE RESTRICT,
  from_house_id TEXT REFERENCES house_master(id) ON DELETE RESTRICT,
  to_house_id TEXT REFERENCES house_master(id) ON DELETE RESTRICT,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  created_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS student_enrollment_change_history_idx
  ON student_enrollment_change (
    organization_id, person_id, academic_session_id, effective_on DESC, created_at DESC
  );

CREATE INDEX IF NOT EXISTS student_enrollment_change_enrollment_idx
  ON student_enrollment_change (organization_id, enrollment_id, created_at DESC);
