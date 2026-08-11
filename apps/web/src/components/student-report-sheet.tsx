import { ArrowLeft, Download, FileText, LoaderCircle, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

type ReportStudent = {
  personId: string;
  displayName: string;
  primaryIdentifier: string;
  gender: "female" | "male" | "other" | "unknown" | null;
  schoolName: string | null;
  className: string;
  classTitle: string | null;
  houseName: string | null;
  rollNumber: string | null;
  enrollmentStatus:
    | "recorded"
    | "enrolled"
    | "transferred"
    | "withdrawn"
    | "completed"
    | "graduated";
};

type StudentReportResponse = {
  generatedAt: string;
  organizationName: string;
  session: { id: string; name: string; startsOn: string; endsOn: string };
  students: ReportStudent[];
  total: number;
};

export type StudentReportRequest = {
  title: string;
  description: string;
  fileName: string;
  filterSummary: string[];
  hideSchoolAndClass?: boolean;
  parameters: {
    sessionId: string;
    q: string;
    school: string;
    className: string;
    house: string;
    status: string;
  };
};

export function StudentReportSheet({
  onOpenChange,
  request,
}: {
  onOpenChange: (open: boolean) => void;
  request: StudentReportRequest | null;
}) {
  const [data, setData] = useState<StudentReportResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!request) {
      setData(null);
      setError("");
      return;
    }
    const controller = new AbortController();
    const parameters = new URLSearchParams({
      sessionId: request.parameters.sessionId,
      q: request.parameters.q,
      school: request.parameters.school,
      class: request.parameters.className,
      house: request.parameters.house,
      status: request.parameters.status,
    });
    setLoading(true);
    setError("");
    void fetch(`/api/school-operations/student-report?${parameters}`, {
      signal: controller.signal,
    })
      .then((response) => parseReportResponse(response))
      .then(setData)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "The report could not be prepared.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [request]);

  const generatedLabel = useMemo(() => {
    if (!data) return "";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(data.generatedAt));
  }, [data]);

  function downloadCsv() {
    if (!data || !request) return;
    const headers = [
      "No.",
      "Student",
      "Admission number",
      "Gender",
      "School",
      "Class",
      "House",
      "Roll number",
      "Enrollment status",
    ];
    const rows = data.students.map((student, index) => [
      String(index + 1),
      student.displayName,
      student.primaryIdentifier,
      genderLabel(student.gender),
      student.schoolName ?? "",
      student.classTitle ?? student.className,
      student.houseName ?? "",
      student.rollNumber ?? "",
      enrollmentStatusLabel(student.enrollmentStatus),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(request.fileName)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    if (!data || !request) return;
    const previousTitle = document.title;
    document.title = request.fileName;
    window.addEventListener("afterprint", () => (document.title = previousTitle), { once: true });
    window.print();
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={Boolean(request)}>
      <SheetContent className="student-report-portal max-w-none border-0 bg-muted/70 p-0 sm:max-w-none">
        <div className="student-report-toolbar sticky top-0 z-10 border-b bg-background/95 px-4 py-3 pr-16 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                aria-label="Back to school operations"
                onClick={() => onOpenChange(false)}
                size="icon-sm"
                type="button"
                variant="outline"
              >
                <ArrowLeft />
              </Button>
              <div className="min-w-0">
                <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileText className="size-4 text-primary" /> Print preview
                </SheetTitle>
                <SheetDescription className="mt-0.5 truncate">
                  {request?.title ?? "Student report"}
                </SheetDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button disabled={!data || loading} onClick={downloadCsv} size="sm" variant="outline">
                <Download /> Download CSV
              </Button>
              <Button disabled={!data || loading} onClick={printReport} size="sm">
                <Printer /> Print
              </Button>
            </div>
          </div>
        </div>

        <div className="student-report-scroll flex-1 overflow-auto px-3 py-5 sm:px-6 sm:py-8">
          {loading ? (
            <div className="grid min-h-[60svh] place-items-center text-center">
              <div>
                <LoaderCircle className="mx-auto size-6 animate-spin text-primary" />
                <p className="mt-3 text-sm text-muted-foreground">Preparing the full list…</p>
              </div>
            </div>
          ) : error ? (
            <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-destructive/20 bg-background p-6 text-center shadow-sm">
              <p className="font-semibold">The report could not be prepared</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p>
            </div>
          ) : data && request ? (
            <article className="student-report-print mx-auto min-h-[210mm] w-full max-w-[297mm] bg-white px-5 py-6 text-[#17251e] shadow-[0_18px_60px_rgba(24,47,36,0.16)] sm:px-10 sm:py-9">
              <header className="student-report-header">
                <div className="flex items-start justify-between gap-6 border-b-2 border-[#24664d] pb-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[#24664d] text-sm font-bold tracking-tight text-white">
                      TS
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#24664d]">
                        Tsewa school records
                      </p>
                      <p className="mt-1 truncate text-lg font-semibold tracking-[-0.02em]">
                        {data.organizationName}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[10px] leading-5 text-[#55645c]">
                    <p className="font-semibold text-[#17251e]">{data.session.name}</p>
                    <p>Prepared {generatedLabel}</p>
                  </div>
                </div>

                <div className="grid gap-4 pb-5 pt-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div>
                    <h1 className="text-2xl font-semibold tracking-[-0.035em]">{request.title}</h1>
                    <p className="mt-1 text-xs leading-5 text-[#55645c]">{request.description}</p>
                  </div>
                  <div className="rounded-lg border border-[#d6dfda] bg-[#f4f7f5] px-4 py-2.5 text-right">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#64726b]">
                      Students
                    </p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums">{data.total}</p>
                  </div>
                </div>

                {request.filterSummary.length ? (
                  <div className="mb-5 flex flex-wrap gap-x-5 gap-y-1 border-y border-[#e1e7e3] py-2.5 text-[10px] text-[#55645c]">
                    {request.filterSummary.map((filter) => (
                      <span key={filter}>{filter}</span>
                    ))}
                  </div>
                ) : null}
              </header>

              {data.students.length ? (
                <table className="student-report-table w-full border-collapse text-left text-[10px]">
                  <thead>
                    <tr>
                      <th className="w-8">No.</th>
                      <th>Student</th>
                      <th>Admission no.</th>
                      <th>Gender</th>
                      {!request.hideSchoolAndClass ? (
                        <th className="report-optional">School</th>
                      ) : null}
                      {!request.hideSchoolAndClass ? <th>Class</th> : null}
                      <th className="report-optional">House</th>
                      <th>Roll no.</th>
                      <th className="report-optional">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((student, index) => (
                      <tr key={`${student.personId}-${index}`}>
                        <td className="tabular-nums text-[#68766f]">{index + 1}</td>
                        <td className="font-semibold">{student.displayName}</td>
                        <td className="tabular-nums">{student.primaryIdentifier}</td>
                        <td>{genderLabel(student.gender)}</td>
                        {!request.hideSchoolAndClass ? (
                          <td className="report-optional">{student.schoolName ?? "Not set"}</td>
                        ) : null}
                        {!request.hideSchoolAndClass ? (
                          <td>{student.classTitle ?? student.className}</td>
                        ) : null}
                        <td className="report-optional">{student.houseName ?? "—"}</td>
                        <td className="tabular-nums">{student.rollNumber ?? "—"}</td>
                        <td className="report-optional">
                          {enrollmentStatusLabel(student.enrollmentStatus)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="grid min-h-64 place-items-center border-y border-[#d6dfda] text-center text-sm text-[#64726b]">
                  No students match these filters.
                </div>
              )}

              <footer className="student-report-footer mt-10 grid grid-cols-2 gap-16 text-[10px] text-[#64726b]">
                <div className="border-t border-[#9ba9a1] pt-2">Prepared by</div>
                <div className="border-t border-[#9ba9a1] pt-2">Checked by</div>
              </footer>
            </article>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

async function parseReportResponse(response: Response): Promise<StudentReportResponse> {
  const payload = (await response.json()) as StudentReportResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "The report could not be prepared.");
  return payload;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function safeFileName(value: string) {
  return (
    value
      .trim()
      .replaceAll(/[^a-zA-Z0-9._-]+/g, "-")
      .replaceAll(/^-+|-+$/g, "") || "students"
  );
}

function genderLabel(gender: ReportStudent["gender"]) {
  if (!gender || gender === "unknown") return "Not set";
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

function enrollmentStatusLabel(status: ReportStudent["enrollmentStatus"]) {
  if (status === "recorded") return "Imported record";
  if (status === "graduated") return "Completed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
