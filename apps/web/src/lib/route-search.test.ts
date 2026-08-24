import { describe, expect, it } from "vitest";

import {
  optionalEnum,
  optionalPage,
  optionalString,
  scholarshipSearchSchema,
  schoolSearchSchema,
} from "./route-search";

describe("route search validation", () => {
  it("keeps meaningful shareable string filters", () => {
    expect(optionalString("tenzin")).toBe("tenzin");
    expect(optionalString("  tenzin  ")).toBe("tenzin");
    expect(optionalString("   ")).toBeUndefined();
  });

  it("omits the default page and accepts later positive pages", () => {
    expect(optionalPage(1)).toBeUndefined();
    expect(optionalPage("3")).toBe(3);
    expect(optionalPage("invalid")).toBeUndefined();
    expect(optionalPage(["3"])).toBeUndefined();
    expect(optionalPage(Number.MAX_VALUE)).toBeUndefined();
  });

  it("rejects filter values outside the route catalogue", () => {
    const sections = ["diagnosis", "tb", "advances"] as const;
    expect(optionalEnum("tb", sections)).toBe("tb");
    expect(optionalEnum("billing", sections)).toBeUndefined();
  });

  it("derives a safe, typed school search and strips unknown parameters", () => {
    expect(
      schoolSearchSchema.parse({
        section: "results",
        resultPage: "4",
        resultQ: "  tenzin  ",
        status: "deleted",
        unexpected: "value",
      }),
    ).toEqual({
      section: "results",
      resultPage: 4,
      resultQ: "tenzin",
      status: undefined,
    });
  });

  it("restricts scholarship status to supported values", () => {
    expect(scholarshipSearchSchema.parse({ status: "closed" }).status).toBe("closed");
    expect(scholarshipSearchSchema.parse({ status: "unknown" }).status).toBeUndefined();
  });
});
