export type ResultStatus = "draft" | "verified" | "final";

export type ReportResultRow = {
  subjectId: string;
  subjectName: string;
  gradeTypeId: string | null;
  passingPercentage: number | null;
  assessmentId: string;
  assessmentName: string;
  marks: number | null;
  maximumMarks: number | null;
  note: string | null;
  status: ResultStatus;
  sourceSystem: string;
};

export function subjectsForClass<T extends { id: string }>(
  subjects: T[],
  mappings: Array<{ academicClassId: string; subjectId: string; displayOrder: number | null }>,
  academicClassId: string,
): T[] {
  const configured = mappings.filter((item) => item.academicClassId === academicClassId);
  if (!configured.length) return subjects;
  const order = new Map(configured.map((item) => [item.subjectId, item.displayOrder ?? 0]));
  return subjects
    .filter((item) => order.has(item.id))
    .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
}

export function assessmentMaximum(
  limits: Array<{
    academicClassId: string;
    subjectId: string;
    assessmentId: string;
    maximumMarks: number | null;
  }>,
  academicClassId: string,
  subjectId: string,
  assessmentId: string,
  fallback = 100,
): number {
  return (
    limits.find(
      (item) =>
        item.academicClassId === academicClassId &&
        item.subjectId === subjectId &&
        item.assessmentId === assessmentId,
    )?.maximumMarks ?? fallback
  );
}

export function nextMarkSheetStatus(
  status: ResultStatus,
  action: "verify" | "finalize" | "reopen",
): ResultStatus | null {
  if (action === "verify") return status === "draft" ? "verified" : null;
  if (action === "finalize") return status === "verified" ? "final" : null;
  return status === "verified" || status === "final" ? "draft" : null;
}

export type GradeBand = { gradeTypeId: string; name: string; startsAt: number; endsAt: number };

export function summarizeReportResults(rows: ReportResultRow[], gradeBands: GradeBand[] = []) {
  const subjects = new Map<
    string,
    {
      id: string;
      name: string;
      passingPercentage: number | null;
      gradeTypeId: string | null;
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
      gradeTypeId: row.gradeTypeId,
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
  const list = Array.from(subjects.values()).map((subject) => {
    const percentage =
      subject.maximumMarks > 0 ? (subject.marks / subject.maximumMarks) * 100 : null;
    const bands = subject.gradeTypeId
      ? gradeBands.filter((band) => band.gradeTypeId === subject.gradeTypeId)
      : [];
    const recordedAssessments = subject.assessments.filter((item) => item.marks !== null);
    const gradeValue =
      bands.length && Math.max(...bands.map((band) => band.endsAt)) <= 10
        ? recordedAssessments.length
          ? subject.marks / recordedAssessments.length
          : null
        : percentage;
    return {
      ...subject,
      percentage,
      grade:
        gradeValue === null
          ? null
          : (bands.find((band) => gradeValue >= band.startsAt && gradeValue <= band.endsAt)?.name ??
            null),
      passed:
        percentage !== null && subject.passingPercentage !== null
          ? percentage >= subject.passingPercentage
          : null,
    };
  });
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
