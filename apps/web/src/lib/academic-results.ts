export type ResultStatus = "draft" | "verified" | "final";

export type ReportResultRow = {
  subjectId: string;
  subjectName: string;
  passingPercentage: number | null;
  assessmentId: string;
  assessmentName: string;
  marks: number | null;
  maximumMarks: number | null;
  note: string | null;
  status: ResultStatus;
  sourceSystem: string;
};

export function nextMarkSheetStatus(
  status: ResultStatus,
  action: "verify" | "finalize" | "reopen",
): ResultStatus | null {
  if (action === "verify") return status === "draft" ? "verified" : null;
  if (action === "finalize") return status === "verified" ? "final" : null;
  return status === "verified" || status === "final" ? "draft" : null;
}

export function summarizeReportResults(rows: ReportResultRow[]) {
  const subjects = new Map<
    string,
    {
      id: string;
      name: string;
      passingPercentage: number | null;
      assessments: ReportResultRow[];
      marks: number;
      maximumMarks: number;
    }
  >();
  for (const row of rows) {
    const subject = subjects.get(row.subjectId) ?? {
      id: row.subjectId,
      name: row.subjectName,
      passingPercentage: row.passingPercentage,
      assessments: [],
      marks: 0,
      maximumMarks: 0,
    };
    subject.assessments.push(row);
    if (row.marks !== null) {
      subject.marks += row.marks;
      subject.maximumMarks += row.maximumMarks ?? 0;
    }
    subjects.set(row.subjectId, subject);
  }
  const list = Array.from(subjects.values()).map((subject) => ({
    ...subject,
    percentage: subject.maximumMarks > 0 ? (subject.marks / subject.maximumMarks) * 100 : null,
    passed:
      subject.maximumMarks > 0 && subject.passingPercentage !== null
        ? (subject.marks / subject.maximumMarks) * 100 >= subject.passingPercentage
        : null,
  }));
  const marks = list.reduce((total, subject) => total + subject.marks, 0);
  const maximumMarks = list.reduce((total, subject) => total + subject.maximumMarks, 0);
  return {
    subjects: list,
    marks,
    maximumMarks,
    percentage: maximumMarks > 0 ? (marks / maximumMarks) * 100 : null,
    publicationStatus: rows.some((row) => row.status === "draft")
      ? ("draft" as const)
      : rows.some((row) => row.status === "verified")
        ? ("verified" as const)
        : ("final" as const),
  };
}
