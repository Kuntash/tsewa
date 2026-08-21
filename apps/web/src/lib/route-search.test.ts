import { describe, expect, it } from "vitest";

import { optionalEnum, optionalPage, optionalString } from "./route-search";

describe("route search validation", () => {
  it("keeps meaningful shareable string filters", () => {
    expect(optionalString("tenzin")).toBe("tenzin");
    expect(optionalString("   ")).toBeUndefined();
  });

  it("omits the default page and accepts later positive pages", () => {
    expect(optionalPage(1)).toBeUndefined();
    expect(optionalPage("3")).toBe(3);
    expect(optionalPage("invalid")).toBeUndefined();
  });

  it("rejects filter values outside the route catalogue", () => {
    const sections = ["diagnosis", "tb", "advances"] as const;
    expect(optionalEnum("tb", sections)).toBe("tb");
    expect(optionalEnum("billing", sections)).toBeUndefined();
  });
});
