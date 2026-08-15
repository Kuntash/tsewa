import { describe, expect, it } from "vitest";

import { nextMarkSheetStatus, summarizeReportResults } from "./academic-results";

describe("academic result workflow", () => {
  it("allows only the configured verification transitions", () => {
    expect(nextMarkSheetStatus("draft", "verify")).toBe("verified");
    expect(nextMarkSheetStatus("verified", "finalize")).toBe("final");
    expect(nextMarkSheetStatus("final", "reopen")).toBe("draft");
    expect(nextMarkSheetStatus("draft", "finalize")).toBeNull();
  });

  it("totals only recorded assessments and preserves draft publication state", () => {
    const summary = summarizeReportResults([
      {
        subjectId: "math",
        subjectName: "Mathematics",
        passingPercentage: 40,
        assessmentId: "exam",
        assessmentName: "Exam",
        marks: 72,
        maximumMarks: 100,
        note: null,
        status: "final",
        sourceSystem: "tsewa",
      },
      {
        subjectId: "science",
        subjectName: "Science",
        passingPercentage: 40,
        assessmentId: "exam",
        assessmentName: "Exam",
        marks: null,
        maximumMarks: 100,
        note: null,
        status: "draft",
        sourceSystem: "tsewa",
      },
    ]);
    expect(summary.marks).toBe(72);
    expect(summary.maximumMarks).toBe(100);
    expect(summary.percentage).toBe(72);
    expect(summary.publicationStatus).toBe("draft");
    expect(summary.subjects[0]?.passed).toBe(true);
  });
});
