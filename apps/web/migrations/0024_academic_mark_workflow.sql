ALTER TABLE mark_sheet ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE mark_sheet ADD COLUMN verified_at TEXT;
ALTER TABLE mark_sheet ADD COLUMN verified_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL;
ALTER TABLE mark_sheet ADD COLUMN finalized_at TEXT;
ALTER TABLE mark_sheet ADD COLUMN finalized_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL;
ALTER TABLE mark_sheet ADD COLUMN created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL;
ALTER TABLE mark_sheet ADD COLUMN updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL;

UPDATE mark_sheet
SET status = CASE WHEN is_verified = 1 THEN 'verified' ELSE 'draft' END;

CREATE UNIQUE INDEX mark_sheet_scope_unique_idx
  ON mark_sheet (
    organization_id,
    academic_session_id,
    school_id,
    academic_class_id,
    subject_id,
    term_id
  );

CREATE INDEX mark_sheet_status_idx
  ON mark_sheet (organization_id, academic_session_id, status, recorded_on);

ALTER TABLE student_mark ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE student_mark ADD COLUMN removed_at TEXT;
ALTER TABLE student_mark ADD COLUMN created_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL;
ALTER TABLE student_mark ADD COLUMN updated_by_user_id TEXT REFERENCES user(id) ON DELETE SET NULL;

CREATE INDEX student_mark_active_sheet_idx
  ON student_mark (organization_id, mark_sheet_id, is_active, person_id);
