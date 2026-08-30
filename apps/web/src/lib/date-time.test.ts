import { describe, expect, it } from "vitest";

import { formatInstant, toEpochMilliseconds } from "./date-time";

describe("date-time", () => {
  it("treats SQLite timestamps as UTC instants", () => {
    expect(toEpochMilliseconds("2026-08-31 10:15:30")).toBe(Date.UTC(2026, 7, 31, 10, 15, 30));
  });

  it("formats one epoch using the organization timezone", () => {
    const epoch = Date.UTC(2026, 7, 31, 10, 15, 30);
    expect(
      formatInstant(epoch, "en-IN", "Asia/Kolkata", {
        day: undefined,
        month: undefined,
        year: undefined,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    ).toBe("15:45");
  });
});
