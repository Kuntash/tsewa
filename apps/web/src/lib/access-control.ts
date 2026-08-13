export const permissionCatalog = [
  ["organization.settings.read", "View organization settings", "Organization"],
  ["organization.settings.manage", "Manage organization settings", "Organization"],
  ["organization.members.read", "View members and invitations", "Organization"],
  ["organization.members.manage", "Manage members and invitations", "Organization"],
  ["organization.roles.read", "View groups, roles, and permissions", "Organization"],
  ["organization.roles.manage", "Configure group role assignments", "Organization"],
  ["audit.read", "View organization audit history", "Organization"],
  ["people.read", "View people and profiles", "People"],
  ["people.create", "Create people records", "People"],
  ["people.update", "Edit core people records", "People"],
  ["people.family.manage", "Manage family relationships", "People"],
  ["people.placement.manage", "Manage home placements", "People"],
  ["people.files.read", "View protected files", "People"],
  ["people.files.manage", "Upload, replace, and remove files", "People"],
  ["school.read", "View school operations", "School"],
  ["school.setup.manage", "Manage schools, classes, houses, and assignments", "School"],
  ["school.enrollment.manage", "Manage admissions and enrollments", "School"],
  ["school.results.read", "View academic results", "School"],
  ["school.results.manage", "Manage academic results", "School"],
  ["school.reports.export", "Print and export school reports", "School"],
  ["sponsorship.read", "View sponsorship records", "Sponsorship"],
  ["sponsorship.manage", "Manage sponsorship records", "Sponsorship"],
  ["scholarship.read", "View scholarship records", "Scholarship"],
  ["scholarship.manage", "Manage scholarship records", "Scholarship"],
  ["health.read", "View health records", "Health"],
  ["health.manage", "Manage health records", "Health"],
  ["staff.read", "View staff operations", "Staff"],
  ["staff.manage", "Manage staff operations", "Staff"],
] as const;

export type PermissionKey = (typeof permissionCatalog)[number][0];
export type AccessGroupKey = "owner" | "admin" | "staff" | "viewer";

export const roleCatalog = [
  {
    key: "organization_administrator",
    name: "Organization administrator",
    description: "Organization settings, access, invitations, and audit history.",
  },
  {
    key: "registration",
    name: "Registration",
    description: "People records, family relationships, placements, and documents.",
  },
  {
    key: "school",
    name: "School",
    description: "School setup, admissions, enrollment, results, and reports.",
  },
  {
    key: "sponsorship",
    name: "Sponsorship",
    description: "Sponsors, beneficiary links, funds, correspondence, and visitors.",
  },
  {
    key: "scholarship",
    name: "Scholarship",
    description: "Scholarship records, sanctions, advances, and reports.",
  },
  {
    key: "dispensary",
    name: "Dispensary",
    description: "Medical, diagnosis, treatment, TB, and settlement records.",
  },
  {
    key: "staff_operations",
    name: "Staff operations",
    description: "Staff employment, leave, holidays, and ledgers.",
  },
  {
    key: "auditor",
    name: "Auditor",
    description: "Read-only access across operational records and audit history.",
  },
] as const;

export type AccessRoleKey = (typeof roleCatalog)[number]["key"];

export const rolePermissionDefaults: Record<AccessRoleKey, readonly PermissionKey[]> = {
  organization_administrator: [
    "organization.settings.read",
    "organization.settings.manage",
    "organization.members.read",
    "organization.members.manage",
    "organization.roles.read",
    "organization.roles.manage",
    "audit.read",
  ],
  registration: [
    "people.read",
    "people.create",
    "people.update",
    "people.family.manage",
    "people.placement.manage",
    "people.files.read",
    "people.files.manage",
  ],
  school: [
    "school.read",
    "school.setup.manage",
    "school.enrollment.manage",
    "school.results.read",
    "school.results.manage",
    "school.reports.export",
  ],
  sponsorship: ["sponsorship.read", "sponsorship.manage"],
  scholarship: ["scholarship.read", "scholarship.manage"],
  dispensary: ["health.read", "health.manage"],
  staff_operations: ["staff.read", "staff.manage"],
  auditor: [
    "organization.settings.read",
    "organization.members.read",
    "organization.roles.read",
    "audit.read",
    "people.read",
    "people.files.read",
    "school.read",
    "school.results.read",
    "school.reports.export",
    "sponsorship.read",
    "scholarship.read",
    "health.read",
    "staff.read",
  ],
};

export const groupCatalog: ReadonlyArray<{
  key: AccessGroupKey;
  name: string;
  description: string;
}> = [
  {
    key: "owner",
    name: "Owner",
    description: "Protected organization owner with every functional role.",
  },
  {
    key: "admin",
    name: "Administrator",
    description: "Runs the organization and manages access across modules.",
  },
  {
    key: "staff",
    name: "Staff",
    description: "Operational access assembled from assigned functional roles.",
  },
  {
    key: "viewer",
    name: "Viewer",
    description: "Read-only operational and audit access.",
  },
];

export const groupRoleDefaults: Record<AccessGroupKey, readonly AccessRoleKey[]> = {
  owner: roleCatalog.map((role) => role.key),
  admin: roleCatalog.map((role) => role.key),
  staff: ["registration", "school"],
  viewer: ["auditor"],
};

export function groupLabel(group: AccessGroupKey): string {
  return groupCatalog.find((item) => item.key === group)?.name ?? group;
}
