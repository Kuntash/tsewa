PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS access_permission (
  key TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS access_role (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 1 CHECK (is_system IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, key)
);

CREATE TABLE IF NOT EXISTS access_role_permission (
  role_id TEXT NOT NULL REFERENCES access_role(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES access_permission(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS access_group (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  key TEXT NOT NULL CHECK (key IN ('owner', 'admin', 'staff', 'viewer')),
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 1 CHECK (is_system IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, key)
);

CREATE TABLE IF NOT EXISTS access_group_role (
  group_id TEXT NOT NULL REFERENCES access_group(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES access_role(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, role_id)
);

ALTER TABLE organization_member
  ADD COLUMN group_id TEXT REFERENCES access_group(id) ON DELETE RESTRICT;

ALTER TABLE organization_invitation
  ADD COLUMN group_id TEXT REFERENCES access_group(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS access_role_org_idx ON access_role (organization_id, name);
CREATE INDEX IF NOT EXISTS access_group_org_idx ON access_group (organization_id, name);
CREATE INDEX IF NOT EXISTS organization_member_group_idx ON organization_member (group_id);
CREATE INDEX IF NOT EXISTS organization_invitation_group_idx ON organization_invitation (group_id);

INSERT OR IGNORE INTO access_permission (key, name, category) VALUES
  ('organization.settings.read', 'View organization settings', 'Organization'),
  ('organization.settings.manage', 'Manage organization settings', 'Organization'),
  ('organization.members.read', 'View members and invitations', 'Organization'),
  ('organization.members.manage', 'Manage members and invitations', 'Organization'),
  ('organization.roles.read', 'View groups, roles, and permissions', 'Organization'),
  ('organization.roles.manage', 'Configure group role assignments', 'Organization'),
  ('audit.read', 'View organization audit history', 'Organization'),
  ('people.read', 'View people and profiles', 'People'),
  ('people.create', 'Create people records', 'People'),
  ('people.update', 'Edit core people records', 'People'),
  ('people.family.manage', 'Manage family relationships', 'People'),
  ('people.placement.manage', 'Manage home placements', 'People'),
  ('people.files.read', 'View protected files', 'People'),
  ('people.files.manage', 'Upload, replace, and remove files', 'People'),
  ('school.read', 'View school operations', 'School'),
  ('school.setup.manage', 'Manage school setup', 'School'),
  ('school.enrollment.manage', 'Manage admissions and enrollments', 'School'),
  ('school.results.read', 'View academic results', 'School'),
  ('school.results.manage', 'Manage academic results', 'School'),
  ('school.reports.export', 'Print and export school reports', 'School'),
  ('sponsorship.read', 'View sponsorship records', 'Sponsorship'),
  ('sponsorship.manage', 'Manage sponsorship records', 'Sponsorship'),
  ('scholarship.read', 'View scholarship records', 'Scholarship'),
  ('scholarship.manage', 'Manage scholarship records', 'Scholarship'),
  ('health.read', 'View health records', 'Health'),
  ('health.manage', 'Manage health records', 'Health'),
  ('staff.read', 'View staff operations', 'Staff'),
  ('staff.manage', 'Manage staff operations', 'Staff');

WITH seed(key, name, description) AS (VALUES
  ('organization_administrator', 'Organization administrator',
   'Organization settings, access, invitations, and audit history.'),
  ('registration', 'Registration',
   'People records, family relationships, placements, and documents.'),
  ('school', 'School',
   'School setup, admissions, enrollment, results, and reports.'),
  ('sponsorship', 'Sponsorship',
   'Sponsors, beneficiary links, funds, correspondence, and visitors.'),
  ('scholarship', 'Scholarship',
   'Scholarship records, sanctions, advances, and reports.'),
  ('dispensary', 'Dispensary',
   'Medical, diagnosis, treatment, TB, and settlement records.'),
  ('staff_operations', 'Staff operations',
   'Staff employment, leave, holidays, and ledgers.'),
  ('auditor', 'Auditor',
   'Read-only access across operational records and audit history.')
)
INSERT OR IGNORE INTO access_role (id, organization_id, key, name, description)
SELECT organization.id || ':role:' || seed.key, organization.id, seed.key, seed.name, seed.description
FROM organization
CROSS JOIN seed;

WITH seed(key, name, description) AS (VALUES
  ('owner', 'Owner', 'Protected organization owner with every functional role.'),
  ('admin', 'Administrator', 'Runs the organization and manages access across modules.'),
  ('staff', 'Staff', 'Operational access assembled from assigned functional roles.'),
  ('viewer', 'Viewer', 'Read-only operational and audit access.')
)
INSERT OR IGNORE INTO access_group (id, organization_id, key, name, description)
SELECT organization.id || ':group:' || seed.key, organization.id, seed.key, seed.name, seed.description
FROM organization
CROSS JOIN seed;

WITH mapping(role_key, permission_key) AS (VALUES
  ('organization_administrator', 'organization.settings.read'),
  ('organization_administrator', 'organization.settings.manage'),
  ('organization_administrator', 'organization.members.read'),
  ('organization_administrator', 'organization.members.manage'),
  ('organization_administrator', 'organization.roles.read'),
  ('organization_administrator', 'organization.roles.manage'),
  ('organization_administrator', 'audit.read'),
  ('registration', 'people.read'),
  ('registration', 'people.create'),
  ('registration', 'people.update'),
  ('registration', 'people.family.manage'),
  ('registration', 'people.placement.manage'),
  ('registration', 'people.files.read'),
  ('registration', 'people.files.manage'),
  ('school', 'school.read'),
  ('school', 'school.setup.manage'),
  ('school', 'school.enrollment.manage'),
  ('school', 'school.results.read'),
  ('school', 'school.results.manage'),
  ('school', 'school.reports.export'),
  ('sponsorship', 'sponsorship.read'),
  ('sponsorship', 'sponsorship.manage'),
  ('scholarship', 'scholarship.read'),
  ('scholarship', 'scholarship.manage'),
  ('dispensary', 'health.read'),
  ('dispensary', 'health.manage'),
  ('staff_operations', 'staff.read'),
  ('staff_operations', 'staff.manage'),
  ('auditor', 'organization.settings.read'),
  ('auditor', 'organization.members.read'),
  ('auditor', 'organization.roles.read'),
  ('auditor', 'audit.read'),
  ('auditor', 'people.read'),
  ('auditor', 'people.files.read'),
  ('auditor', 'school.read'),
  ('auditor', 'school.results.read'),
  ('auditor', 'school.reports.export'),
  ('auditor', 'sponsorship.read'),
  ('auditor', 'scholarship.read'),
  ('auditor', 'health.read'),
  ('auditor', 'staff.read')
)
INSERT OR IGNORE INTO access_role_permission (role_id, permission_key)
SELECT role.id, mapping.permission_key
FROM access_role role
JOIN mapping ON mapping.role_key = role.key;

INSERT OR IGNORE INTO access_group_role (group_id, role_id)
SELECT access_group.id, access_role.id
FROM access_group
JOIN access_role ON access_role.organization_id = access_group.organization_id
WHERE access_group.key IN ('owner', 'admin')
   OR (access_group.key = 'staff' AND access_role.key IN ('registration', 'school'))
   OR (access_group.key = 'viewer' AND access_role.key = 'auditor');

UPDATE organization_member
SET group_id = organization_id || ':group:' || role
WHERE group_id IS NULL;

UPDATE organization_invitation
SET group_id = organization_id || ':group:' || role
WHERE group_id IS NULL;
