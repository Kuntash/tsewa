import { describe, expect, it } from "vitest";

import { permissionsForGroup, visibleAccessGroups } from "./access-control";

describe("static access control", () => {
  it("gives administrators organization and operational management access", () => {
    const permissions = permissionsForGroup("admin");
    expect(permissions).toContain("organization.settings.manage");
    expect(permissions).toContain("people.files.manage");
    expect(permissions).toContain("staff.manage");
  });

  it("gives staff operational edit access without organization management", () => {
    const permissions = permissionsForGroup("staff");
    expect(permissions).toContain("people.files.manage");
    expect(permissions).toContain("staff.manage");
    expect(permissions).not.toContain("organization.members.manage");
    expect(permissions).not.toContain("audit.read");
  });

  it("keeps viewers read-only", () => {
    const permissions = permissionsForGroup("viewer");
    expect(permissions).toContain("people.files.read");
    expect(permissions).toContain("school.results.read");
    expect(permissions.some((permission) => permission.endsWith(".manage"))).toBe(false);
    expect(permissions).not.toContain("people.create");
    expect(permissions).not.toContain("people.update");
  });

  it("shows only the three assignable roles", () => {
    expect(visibleAccessGroups().map(({ key }) => key)).toEqual(["admin", "staff", "viewer"]);
  });
});
