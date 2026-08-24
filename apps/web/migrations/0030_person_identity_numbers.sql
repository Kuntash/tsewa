ALTER TABLE person ADD COLUMN education_number TEXT;
ALTER TABLE person ADD COLUMN registration_certificate_number TEXT;
ALTER TABLE person ADD COLUMN identity_certificate_number TEXT;

-- Staff identity values already preserved by migration 0029 should also be
-- available from the shared person profile.
UPDATE person
SET registration_certificate_number = (
      SELECT profile.registration_certificate_number
      FROM staff_profile profile
      WHERE profile.person_id = person.id
        AND profile.organization_id = person.organization_id
    ),
    identity_certificate_number = (
      SELECT profile.identity_card_number
      FROM staff_profile profile
      WHERE profile.person_id = person.id
        AND profile.organization_id = person.organization_id
    )
WHERE kind = 'staff'
  AND EXISTS (
    SELECT 1
    FROM staff_profile profile
    WHERE profile.person_id = person.id
      AND profile.organization_id = person.organization_id
  );
