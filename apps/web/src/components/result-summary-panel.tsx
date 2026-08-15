import { Download, FileText, LoaderCircle, Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { summarizeReportResults } from "@/lib/academic-results";
import type { ReportResultRow } from "@/lib/academic-results";

type Summary = {
  personId: string;
  studentName: string;
  admissionNumber: string;
  schoolName: string;
  className: string;
  termId: string;
  termName: string;
  subjectCount: number;
  totalMarks: number;
  totalMaximum: number;
  recordedCount: number;
  percentage: number | null;
  publicationStatus: "draft" | "verified" | "final";
};
type SummaryResponse = {
  summaries: Summary[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};
type ReportCardResponse = {
  generatedAt: string;
  organizationName: string;
  session: { id: string; name: string; startsOn: string; endsOn: string };
  student: {
    personId: string;
    studentName: string;
    admissionNumber: string;
    schoolName: string;
    className: string;
    termId: string;
    termName: string;
  };
  results: ReportResultRow[];
};

export function ResultSummaryPanel({
  className,
  query,
  refreshKey,
  school,
  sessionId,
  subject,
  term,
}: {
  className: string;
  query: string;
  refreshKey: number;
  school: string;
  sessionId: string;
  subject: string;
  term: string;
}) {
  const [data, setData] = useState<SummaryResponse>({
    summaries: [],
    pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportRequest, setReportRequest] = useState<Summary | null>(null);

  useEffect(() => setPage(1), [className, query, school, sessionId, subject, term]);
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    const parameters = new URLSearchParams({
      sessionId,
      q: query,
      school,
      class: className,
      subject,
      term,
      page: String(page),
      pageSize: "10",
    });
    setLoading(true);
    setError("");
    void fetch(`/api/school-operations/results/summaries?${parameters}`, {
      signal: controller.signal,
    })
      .then((response) => parse<SummaryResponse>(response))
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Summaries could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [className, page, query, refreshKey, school, sessionId, subject, term]);

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
            <div>
              <p className="text-sm font-semibold">Student result summaries</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Term totals across subjects, ready for report-card review.
              </p>
            </div>
            <Badge variant="secondary">{data.pagination.total} students</Badge>
          </div>
          {loading ? (
            <div className="grid min-h-40 place-items-center">
              <LoaderCircle className="size-5 animate-spin text-primary" />
            </div>
          ) : error ? (
            <p className="m-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : data.summaries.length ? (
            <div className="divide-y">
              {data.summaries.map((summary) => (
                <button
                  className="grid w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/35 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                  key={`${summary.personId}:${summary.termId}`}
                  onClick={() => setReportRequest(summary)}
                  type="button"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{summary.studentName}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {summary.admissionNumber} · {summary.schoolName} · {summary.className} ·{" "}
                      {summary.termName}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-base font-semibold tabular-nums">
                      {formatPercentage(summary.percentage)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {summary.subjectCount} subjects · {summary.recordedCount} marks
                    </p>
                  </div>
                  <Badge variant={summary.publicationStatus === "final" ? "default" : "secondary"}>
                    {statusLabel(summary.publicationStatus)}
                  </Badge>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid min-h-36 place-items-center px-6 text-center text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Search className="size-4" /> No student summaries match these filters.
              </span>
            </div>
          )}
          {data.pagination.totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
              <Button
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                size="sm"
                variant="outline"
              >
                Previous
              </Button>
              <span>
                {page} / {data.pagination.totalPages}
              </span>
              <Button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((value) => value + 1)}
                size="sm"
                variant="outline"
              >
                Next
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <ReportCardSheet
        onOpenChange={(open) => {
          if (!open) setReportRequest(null);
        }}
        request={reportRequest ? { ...reportRequest, sessionId } : null}
      />
    </>
  );
}

function ReportCardSheet({
  onOpenChange,
  request,
}: {
  onOpenChange: (open: boolean) => void;
  request: (Summary & { sessionId: string }) | null;
}) {
  const [data, setData] = useState<ReportCardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!request) {
      setData(null);
      setError("");
      return;
    }
    const controller = new AbortController();
    const parameters = new URLSearchParams({
      sessionId: request.sessionId,
      personId: request.personId,
      termId: request.termId,
    });
    setLoading(true);
    setError("");
    void fetch(`/api/school-operations/results/report-card?${parameters}`, {
      signal: controller.signal,
    })
      .then((response) => parse<ReportCardResponse>(response))
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : "The report card could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [request]);
  const summary = useMemo(() => (data ? summarizeReportResults(data.results) : null), [data]);

  function downloadCsv() {
    if (!data || !summary) return;
    const rows = [
      ["Subject", "Assessment", "Marks", "Maximum marks", "Subject total", "Percentage", "Status"],
      ...summary.subjects.flatMap((subject) =>
        subject.assessments.map((assessment, index) => [
          index === 0 ? subject.name : "",
          assessment.assessmentName,
          assessment.marks === null ? "" : String(assessment.marks),
          assessment.maximumMarks === null ? "" : String(assessment.maximumMarks),
          index === 0 ? `${subject.marks}/${subject.maximumMarks}` : "",
          index === 0 ? formatPercentage(subject.percentage) : "",
          statusLabel(assessment.status),
        ]),
      ),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(`${data.student.studentName}-${data.student.termName}-report-card`)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    if (!data) return;
    const title = document.title;
    document.title = `${data.student.studentName} – ${data.student.termName}`;
    window.addEventListener("afterprint", () => (document.title = title), { once: true });
    window.print();
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={Boolean(request)}>
      <SheetContent className="student-report-portal max-w-none border-0 bg-muted/70 p-0 sm:max-w-none">
        <div className="student-report-toolbar sticky top-0 z-10 border-b bg-background/95 px-5 py-4 pr-16 backdrop-blur">
          <div className="mx-auto flex max-w-[1000px] items-center justify-between gap-4">
            <div>
              <SheetTitle className="flex items-center gap-2">
                <FileText className="size-4 text-primary" /> Report card
              </SheetTitle>
              <SheetDescription>{request?.studentName ?? "Student result"}</SheetDescription>
            </div>
            <div className="flex gap-2">
              <Button disabled={!data || loading} onClick={downloadCsv} size="sm" variant="outline">
                <Download /> CSV
              </Button>
              <Button disabled={!data || loading} onClick={printReport} size="sm">
                <Printer /> Print
              </Button>
            </div>
          </div>
        </div>
        <div className="student-report-scroll flex-1 overflow-auto p-4 sm:p-8">
          {loading ? (
            <div className="grid min-h-[60svh] place-items-center">
              <LoaderCircle className="size-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <p className="mx-auto mt-12 max-w-lg rounded-2xl bg-background p-6 text-center text-sm text-destructive">
              {error}
            </p>
          ) : data && summary ? (
            <article className="student-report-print mx-auto min-h-[210mm] w-full max-w-[1000px] bg-white px-8 py-10 text-[#17251e] shadow-[0_18px_60px_rgba(24,47,36,0.16)] sm:px-14">
              <header className="border-b-2 border-[#24664d] pb-6">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#24664d]">
                      Tsewa school records
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                      {data.organizationName}
                    </h1>
                    <p className="mt-1 text-sm text-[#55645c]">
                      Academic report card · {data.session.name}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#edf4f0] px-4 py-3 text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#64726b]">
                      Overall
                    </p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {formatPercentage(summary.percentage)}
                    </p>
                    <p className="text-[10px] text-[#55645c]">
                      {statusLabel(summary.publicationStatus)}
                    </p>
                  </div>
                </div>
                <div className="mt-7 grid grid-cols-2 gap-x-8 gap-y-3 text-xs sm:grid-cols-4">
                  <Detail label="Student" value={data.student.studentName} />
                  <Detail label="Admission no." value={data.student.admissionNumber} />
                  <Detail
                    label="School / class"
                    value={`${data.student.schoolName} · ${data.student.className}`}
                  />
                  <Detail label="Term" value={data.student.termName} />
                </div>
              </header>
              <table className="student-report-table mt-7 w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Assessment breakdown</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Percent</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.subjects.map((subject) => (
                    <tr key={subject.id}>
                      <td className="font-semibold">{subject.name}</td>
                      <td>
                        {subject.assessments
                          .map(
                            (item) =>
                              `${item.assessmentName}: ${formatMark(item.marks, item.maximumMarks)}`,
                          )
                          .join(" · ")}
                      </td>
                      <td className="text-right tabular-nums">
                        {subject.marks}/{subject.maximumMarks || "—"}
                      </td>
                      <td className="text-right font-semibold tabular-nums">
                        {formatPercentage(subject.percentage)}
                      </td>
                      <td>
                        {subject.passed === null ? "—" : subject.passed ? "Pass" : "Needs support"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {summary.publicationStatus === "draft" ? (
                <p className="mt-6 border border-dashed border-[#bd6d2a] bg-[#fff8ef] px-4 py-3 text-xs font-semibold text-[#8b4f1d]">
                  Draft result — review before issuing as an official record.
                </p>
              ) : null}
              <footer className="mt-16 grid grid-cols-2 gap-16 text-[10px] text-[#64726b]">
                <div className="border-t pt-2">Class teacher</div>
                <div className="border-t pt-2">School administration</div>
              </footer>
            </article>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-[#64726b]">{label}</p>
      <p className="mt-1 font-semibold">{value || "—"}</p>
    </div>
  );
}
function statusLabel(status: "draft" | "verified" | "final") {
  return status === "final" ? "Final" : status === "verified" ? "Verified" : "Draft";
}
function formatPercentage(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}
function formatMark(marks: number | null, maximum: number | null) {
  return marks === null ? "—" : maximum === null ? String(marks) : `${marks}/${maximum}`;
}
function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Results could not be loaded.");
  return body;
}
