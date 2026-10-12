-- Match the registry's case-insensitive sort, including a stable pagination tie-breaker.
-- Leading-wildcard searches still scan candidates, but no longer sort the whole registry.
CREATE INDEX IF NOT EXISTS person_registry_sort_idx
  ON person (organization_id, lower(display_name), primary_identifier, id);
CREATE INDEX IF NOT EXISTS person_registry_kind_sort_idx
  ON person (organization_id, kind, lower(display_name), primary_identifier, id);
CREATE INDEX IF NOT EXISTS person_registry_status_sort_idx
  ON person (organization_id, status, lower(display_name), primary_identifier, id);
CREATE INDEX IF NOT EXISTS person_registry_kind_status_sort_idx
  ON person (organization_id, kind, status, lower(display_name), primary_identifier, id);
