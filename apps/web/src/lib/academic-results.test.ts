import { describe, expect, it } from "vitest";

import {
  assessmentMaximum,
  nextMarkSheetStatus,
  subjectsForClass,
  summarizeReportResults,
} from "./academic-results";
import type { ReportResultRow } from "./academic-results";

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
        gradeTypeId: null,
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
        gradeTypeId: null,
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

  it("derives subject grades from the configured grade type", () => {
    const summary = summarizeReportResults(
      [
        {
          subjectId: "math",
          subjectName: "Mathematics",
          gradeTypeId: "nine-point",
          passingPercentage: 33,
          assessmentId: "exam",
          assessmentName: "Exam",
          marks: 84,
          maximumMarks: 100,
          note: null,
          status: "final",
          sourceSystem: "tsewa",
        },
      ],
      [{ gradeTypeId: "nine-point", name: "A2", startsAt: 81, endsAt: 90.99 }],
    );
    expect(summary.subjects[0]?.grade).toBe("A2");
  });

  it("uses the average raw score for compact grading scales", () => {
    const row = (assessmentId: string, marks: number): ReportResultRow => ({
      subjectId: "conduct",
      subjectName: "Conduct",
      gradeTypeId: "five-point",
      passingPercentage: null,
      assessmentId,
      assessmentName: assessmentId,
      marks,
      maximumMarks: 5,
      note: null,
      status: "final",
      sourceSystem: "tsewa",
    });
    const summary = summarizeReportResults(
      [row("one", 4), row("two", 5)],
      [{ gradeTypeId: "five-point", name: "A", startsAt: 4.1, endsAt: 5 }],
    );
    expect(summary.subjects[0]?.grade).toBe("A");
  });

  it("uses configured class subjects in report order", () => {
    const subjects = [{ id: "math" }, { id: "science" }, { id: "music" }];
    expect(
      subjectsForClass(
        subjects,
        [
          { academicClassId: "class-1", subjectId: "science", displayOrder: 2 },
          { academicClassId: "class-1", subjectId: "math", displayOrder: 1 },
        ],
        "class-1",
      ).map((item) => item.id),
    ).toEqual(["math", "science"]);
    expect(subjectsForClass(subjects, [], "class-1")).toEqual(subjects);
  });

  it("uses assessment limits while preserving the fallback for unset legacy values", () => {
    const limits = [
      {
        academicClassId: "class-1",
        subjectId: "math",
        assessmentId: "exam",
        maximumMarks: 80,
      },
      {
        academicClassId: "class-1",
        subjectId: "math",
        assessmentId: "oral",
        maximumMarks: null,
      },
    ];
    expect(assessmentMaximum(limits, "class-1", "math", "exam")).toBe(80);
    expect(assessmentMaximum(limits, "class-1", "math", "oral")).toBe(100);
  });
});
