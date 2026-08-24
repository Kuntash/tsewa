CREATE INDEX IF NOT EXISTS student_enrollment_offering_idx
ON student_enrollment (organization_id, school_class_offering_id);
