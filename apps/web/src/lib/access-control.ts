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

export const groupCatalog: ReadonlyArray<{
  key: AccessGroupKey;
  name: string;
  description: string;
}> = [
  {
    key: "owner",
    name: "Owner",
    description: "Protected account with administrator access and ownership transfer rights.",
  },
  {
    key: "admin",
    name: "Administrator",
    description:
      "Can view and edit every module, manage members, and change organization settings.",
  },
  {
    key: "staff",
    name: "Staff",
    description: "Can view and edit every operational module.",
  },
  {
    key: "viewer",
    name: "Viewer",
    description: "Can view every operational module, but cannot add, edit, or remove records.",
  },
];

const allPermissions = permissionCatalog.map(([key]) => key);
const staffPermissions = allPermissions.filter(
  (key) => !key.startsWith("organization.") && key !== "audit.read",
);
const viewerPermissions = staffPermissions.filter(
  (key) => key.endsWith(".read") || key === "school.reports.export",
);

const permissionsByGroup: Record<AccessGroupKey, readonly PermissionKey[]> = {
  owner: allPermissions,
  admin: allPermissions,
  staff: staffPermissions,
  viewer: viewerPermissions,
};

export function permissionsForGroup(group: AccessGroupKey): PermissionKey[] {
  return [...permissionsByGroup[group]];
}

export function visibleAccessGroups() {
  return groupCatalog.filter((group) => group.key !== "owner");
}

export function groupLabel(group: AccessGroupKey): string {
  return groupCatalog.find((item) => item.key === group)?.name ?? group;
}

export function groupDescription(group: AccessGroupKey): string {
  return groupCatalog.find((item) => item.key === group)?.description ?? "";
}
