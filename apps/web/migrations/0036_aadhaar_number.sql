-- Aadhaar is an optional identity number kept alongside the other certificates.
ALTER TABLE person ADD COLUMN aadhaar_number TEXT;
