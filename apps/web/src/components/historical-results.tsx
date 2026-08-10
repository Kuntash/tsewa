import { BookOpenText, ChevronLeft, ChevronRight, LoaderCircle, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type Option = { id: string; name: string; count: number };
type Overview = {
  sessions: Array<{ id: string; name: string; markSheets: number; results: number }>;
  selectedSessionId: string | null;
  summary: { markSheets: number; results: number; students: number };
  filters: { schools: Option[]; classes: Option[]; subjects: Option[]; terms: Option[] };
};
type ResultRow = {
  id: string;
  personId: string;
  studentName: string;
  admissionNumber: string;
  schoolName: string;
  className: string;
  subjectName: string;
  termName: string;
  assessmentName: string;
  marks: number | null;
  maximumMarks: number | null;
  note: string | null;
  recordedOn: string | null;
  isVerified: boolean;
};
type Results = {
  results: ResultRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export function HistoricalResults({ onSelectPerson }: { onSelectPerson: (id: string) => void }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const [school, setSchool] = useState("all");
  const [className, setClassName] = useState("all");
  const [subject, setSubject] = useState("all");
  const [term, setTerm] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Results>({
    results: [],
    pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const parameters = sessionId ? `?${new URLSearchParams({ sessionId })}` : "";
    void fetch(`/api/school-operations/results/overview${parameters}`, {
      signal: controller.signal,
    })
      .then((response) => parse<Overview>(response))
      .then((value) => {
        setOverview(value);
        if (!sessionId && value.selectedSessionId) setSessionId(value.selectedSessionId);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(message(reason));
      });
    return () => controller.abort();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    const parameters = new URLSearchParams({
      sessionId,
      q: debouncedQuery,
      school,
      class: className,
      subject,
      term,
      page: String(page),
      pageSize: "25",
    });
    setLoading(true);
    setError("");
    void fetch(`/api/school-operations/results?${parameters}`, { signal: controller.signal })
      .then((response) => parse<Results>(response))
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(message(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [className, debouncedQuery, page, school, sessionId, subject, term]);

  function changeSession(value: string) {
    setSessionId(value);
    setSchool("all");
    setClassName("all");
    setSubject("all");
    setTerm("all");
    setPage(1);
  }
  const filters = overview?.filters;
  return (
    <div className="mt-7 space-y-4">
      <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm leading-6 text-muted-foreground">
        The old system contains results for 2011 and 2012 only. These records are shown exactly as
        saved and cannot be edited here.
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Students" value={overview?.summary.students ?? 0} icon={Users} />
        <Metric label="Mark sheets" value={overview?.summary.markSheets ?? 0} icon={BookOpenText} />
        <Metric label="Results" value={overview?.summary.results ?? 0} icon={BookOpenText} />
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[180px_minmax(220px,1fr)]">
            <Select onValueChange={changeSession} value={sessionId}>
              <SelectTrigger aria-label="Result year">
                <SelectValue placeholder="Result year" />
              </SelectTrigger>
              <SelectContent>
                {(overview?.sessions ?? []).map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search results"
                className="pl-10"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search student or admission number"
                value={query}
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <ResultFilter
              label="All schools"
              options={filters?.schools ?? []}
              value={school}
              onChange={(v) => {
                setSchool(v);
                setPage(1);
              }}
            />
            <ResultFilter
              label="All classes"
              options={filters?.classes ?? []}
              value={className}
              onChange={(v) => {
                setClassName(v);
                setPage(1);
              }}
            />
            <ResultFilter
              label="All subjects"
              options={filters?.subjects ?? []}
              value={subject}
              onChange={(v) => {
                setSubject(v);
                setPage(1);
              }}
            />
            <ResultFilter
              label="All terms"
              options={filters?.terms ?? []}
              value={term}
              onChange={(v) => {
                setTerm(v);
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>
      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="grid min-h-72 place-items-center">
              <LoaderCircle className="size-5 animate-spin text-primary" />
            </div>
          ) : data.results.length ? (
            <>
              <div className="grid gap-3 p-4 md:hidden">
                {data.results.map((row) => (
                  <button
                    className="rounded-2xl border p-4 text-left"
                    key={row.id}
                    onClick={() => onSelectPerson(row.personId)}
                    type="button"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-semibold">{row.studentName}</p>
                        <p className="text-xs text-muted-foreground">
                          Admission {row.admissionNumber}
                        </p>
                      </div>
                      <Badge variant="secondary">{formatMark(row)}</Badge>
                    </div>
                    <p className="mt-3 text-sm">
                      {row.subjectName} · {row.assessmentName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.schoolName} · {row.className} · {row.termName}
                    </p>
                  </button>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted/45 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Assessment</th>
                      <th className="px-4 py-3 text-right">Marks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.results.map((row) => (
                      <tr
                        className="cursor-pointer hover:bg-muted/35"
                        key={row.id}
                        onClick={() => onSelectPerson(row.personId)}
                      >
                        <td className="px-5 py-4">
                          <p className="font-medium">{row.studentName}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.admissionNumber} · {row.schoolName}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {row.className}
                          <p className="text-xs text-muted-foreground">{row.termName}</p>
                        </td>
                        <td className="px-4 py-4">{row.subjectName}</td>
                        <td className="px-4 py-4">{row.assessmentName}</td>
                        <td className="px-4 py-4 text-right font-semibold tabular-nums">
                          {formatMark(row)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination data={data} setPage={setPage} />
            </>
          ) : (
            <div className="grid min-h-64 place-items-center px-6 text-center text-sm text-muted-foreground">
              No results match these filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <Icon className="size-4 text-primary" />
        <p className="mt-2 text-2xl font-semibold tabular-nums">{Number(value).toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
function ResultFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name} ({option.count})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Pagination({
  data,
  setPage,
}: {
  data: Results;
  setPage: (updater: (value: number) => number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
      <span>{data.pagination.total.toLocaleString()} results</span>
      <div className="flex items-center gap-2">
        <Button
          disabled={data.pagination.page <= 1}
          onClick={() => setPage((v) => Math.max(1, v - 1))}
          size="sm"
          variant="outline"
        >
          <ChevronLeft /> Previous
        </Button>
        <span>
          {data.pagination.page} / {Math.max(1, data.pagination.totalPages)}
        </span>
        <Button
          disabled={data.pagination.page >= data.pagination.totalPages}
          onClick={() => setPage((v) => v + 1)}
          size="sm"
          variant="outline"
        >
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
function formatMark(row: ResultRow) {
  return row.marks === null
    ? "—"
    : row.maximumMarks === null
      ? String(row.marks)
      : `${row.marks}/${row.maximumMarks}`;
}
async function parse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Results could not be loaded.");
  return body;
}
function message(reason: unknown) {
  return reason instanceof Error ? reason.message : "Results could not be loaded.";
}
