PRAGMA foreign_keys = ON;

ALTER TABLE student_enrollment_change ADD COLUMN from_roll_number TEXT;
ALTER TABLE student_enrollment_change ADD COLUMN to_roll_number TEXT;
