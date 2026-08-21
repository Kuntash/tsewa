import {
  ArrowLeft,
  BookOpen,
  Download,
  FileText,
  IndianRupee,
  LoaderCircle,
  Pencil,
  Plus,
  Printer,
  Search,
  Settings2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type Setup = {
  categories: Array<{ id: string; name: string; isActive: number }>;
  courses: Array<{ id: string; categoryId: string | null; name: string; isActive: number }>;
  heads: Array<{ id: string; name: string; isActive: number }>;
  limits: Array<{
    id: string;
    courseGroup: string;
    headName: string;
    amount: number | null;
    isActive: number;
  }>;
  cityAdvances: Array<{ id: string; sessionId: string | null; cityName: string; amount: number }>;
  sessions: Array<{ id: string; name: string }>;
  people: Array<{ id: string; name: string; admissionNumber: string }>;
  capabilities: { manage: boolean };
};
type Scholarship = {
  id: string;
  personId: string | null;
  studentName: string;
  admissionNumber: string | null;
  beneficiaryCategory: string | null;
  instituteName: string | null;
  cityName: string | null;
  status: "active" | "closed";
  admissionYear: number | null;
  courseDuration: string | null;
  courseName: string | null;
  courseCategory: string | null;
  annualDetailCount: number;
  sanctionCount: number;
  sanctionedAmount: number;
  lastSanctionOn: string | null;
};
type ListData = {
  summary: { scholarships: number; active: number; sanctions: number; sanctionedAmount: number };
  scholarships: Scholarship[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  capabilities: { manage: boolean };
};
type ScholarshipRecord = {
  id: string;
  personId: string;
  sessionId: string | null;
  courseId: string;
  beneficiaryCategory: string | null;
  studentName: string;
  admissionNumber: string | null;
  fatherName: string | null;
  instituteName: string | null;
  cityName: string | null;
  admissionYear: number | null;
  courseDuration: string | null;
  classStream: string | null;
  classPercentage: number | null;
  scholarshipAwarded: number | null;
  bankAccountNumber: string | null;
  phone: string | null;
  ledgerNumber: string | null;
  reason: string | null;
  status: "active" | "closed";
  courseName: string;
  courseCategory: string | null;
};
type Detail = {
  record: ScholarshipRecord;
  annualDetails: Array<{
    id: string;
    sessionId: string | null;
    studyYear: string;
    passed: boolean;
    percentage: number | null;
    division: string | null;
    fees: number | null;
    remarks: string | null;
  }>;
  sanctions: Array<{
    id: string;
    sessionId: string | null;
    amount: number;
    sanctionedOn: string;
    periodFrom: string | null;
    periodTo: string | null;
    paymentReference: string | null;
    inFavourOf: string | null;
    remarks: string | null;
    lines: Array<{
      id: string;
      headId: string;
      headName: string;
      cityName: string | null;
      amount: number;
      advanceOn: string | null;
    }>;
  }>;
  capabilities: { manage: boolean };
};
type ScholarshipReport = {
  generatedAt: string;
  report: string;
  title: string;
  sessionName: string;
  columns: Array<{ key: string; label: string; numeric?: boolean }>;
  rows: Array<Record<string, string | number | null>>;
};

const emptyList: ListData = {
  summary: { scholarships: 0, active: 0, sanctions: 0, sanctionedAmount: 0 },
  scholarships: [],
  pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
  capabilities: { manage: false },
};

export type ScholarshipFilters = {
  q?: string;
  status?: string;
  course?: string;
  page?: number;
};

export function ScholarshipOperations({
  activeSessionId,
  filters = {},
  onBack,
  onFiltersChange,
}: {
  activeSessionId: string;
  filters?: ScholarshipFilters;
  onBack: () => void;
  onFiltersChange?: (filters: ScholarshipFilters) => void;
}) {
  const [data, setData] = useState<ListData>(emptyList);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [query, setQuery] = useState(filters.q ?? "");
  const debouncedQuery = useDebouncedValue(query);
  const [status, setStatus] = useState(filters.status ?? "all");
  const [course, setCourse] = useState(filters.course ?? "all");
  const [page, setPage] = useState(filters.page ?? 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Detail["record"] | "new" | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  useEffect(() => {
    setQuery(filters.q ?? "");
    setStatus(filters.status ?? "all");
    setCourse(filters.course ?? "all");
    setPage(filters.page ?? 1);
  }, [filters.course, filters.page, filters.q, filters.status]);

  useEffect(() => {
    onFiltersChange?.({ q: debouncedQuery || undefined, status, course, page });
  }, [course, debouncedQuery, onFiltersChange, page, status]);

  useEffect(() => {
    void loadSetup();
  }, [refreshKey]);
  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({
      q: debouncedQuery,
      status,
      course,
      page: String(page),
      pageSize: "25",
    });
    setLoading(true);
    setError("");
    void fetch(`/api/scholarships?${parameters}`, { signal: controller.signal })
      .then(parse<ListData>)
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(messageOf(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [course, debouncedQuery, page, refreshKey, status]);

  async function loadSetup(q = "") {
    try {
      setSetup(
        await fetch(`/api/scholarships/setup?${new URLSearchParams({ q })}`).then(parse<Setup>),
      );
    } catch (reason) {
      setError(messageOf(reason));
    }
  }
  function saved(text: string) {
    setMessage(text);
    setRefreshKey((value) => value + 1);
  }
  async function exportAll() {
    setMessage("Preparing the full scholarship register…");
    try {
      const rows = await loadAllRows();
      const table = [
        [
          "Student",
          "Admission number",
          "Category",
          "Course",
          "Institute",
          "City",
          "Status",
          "Annual records",
          "Sanctions",
          "Sanctioned amount",
        ],
        ...rows.map((item) => [
          item.studentName,
          item.admissionNumber ?? "",
          item.beneficiaryCategory ?? "",
          item.courseName ?? "",
          item.instituteName ?? "",
          item.cityName ?? "",
          item.status,
          String(item.annualDetailCount),
          String(item.sanctionCount),
          String(item.sanctionedAmount),
        ]),
      ];
      downloadCsv("scholarship-register", table);
      setMessage(`${rows.length} scholarship records exported.`);
    } catch (reason) {
      setError(messageOf(reason));
    }
  }
  async function loadAllRows() {
    const rows: Scholarship[] = [];
    let next = 1;
    let pages = 1;
    do {
      const result = await fetch(
        `/api/scholarships?${new URLSearchParams({ q: debouncedQuery, status, course, page: String(next), pageSize: "100" })}`,
      ).then(parse<ListData>);
      rows.push(...result.scholarships);
      pages = result.pagination.totalPages;
      next += 1;
    } while (next <= pages);
    return rows;
  }
  async function printAll() {
    setMessage("Preparing the full scholarship register…");
    try {
      const rows = await loadAllRows();
      const previous = data;
      setData({
        ...data,
        scholarships: rows,
        pagination: { ...data.pagination, total: rows.length },
      });
      window.addEventListener("afterprint", () => setData(previous), { once: true });
      window.setTimeout(() => window.print(), 50);
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  return (
    <main className="min-h-svh bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-5 md:px-8">
          <Button aria-label="Back" onClick={onBack} size="icon-sm" variant="outline">
            <ArrowLeft />
          </Button>
          <div>
            <p className="font-semibold tracking-tight">Scholarships</p>
            <p className="text-xs text-muted-foreground">
              Awards, progress, sanctions, and policy limits
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button onClick={() => setReportsOpen(true)} size="sm" variant="outline">
              <FileText /> Reports
            </Button>
            <Button onClick={() => void exportAll()} size="sm" variant="outline">
              <Download /> CSV
            </Button>
            <Button onClick={() => void printAll()} size="sm" variant="outline">
              <Printer /> Print
            </Button>
            {data.capabilities.manage ? (
              <Button onClick={() => setSetupOpen(true)} size="sm" variant="outline">
                <Settings2 /> Setup
              </Button>
            ) : null}
            {data.capabilities.manage ? (
              <Button onClick={() => setEditor("new")} size="sm">
                <Plus /> New scholarship
              </Button>
            ) : null}
          </div>
        </div>
      </header>
      <div className="scholarship-report-print mx-auto max-w-[1500px] space-y-5 px-5 py-8 md:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Users} label="Scholarship records" value={data.summary.scholarships} />
          <Metric icon={BookOpen} label="Active awards" value={data.summary.active} />
          <Metric icon={IndianRupee} label="Sanctions" value={data.summary.sanctions} />
          <Metric
            icon={IndianRupee}
            label="Amount sanctioned"
            value={money(data.summary.sanctionedAmount)}
          />
        </div>
        {message ? (
          <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Card className="scholarship-report-controls">
          <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(260px,1fr)_220px_260px]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search scholarships"
                className="pl-10"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search student, admission number, or institute"
                value={query}
              />
            </div>
            <SimpleSelect
              label="Status"
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { id: "all", name: "All statuses" },
                { id: "active", name: "Active" },
                { id: "closed", name: "Closed" },
              ]}
              value={status}
            />
            <SimpleSelect
              label="Course"
              onChange={(value) => {
                setCourse(value);
                setPage(1);
              }}
              options={[{ id: "all", name: "All courses" }, ...(setup?.courses ?? [])]}
              value={course}
            />
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="grid min-h-72 place-items-center">
                <LoaderCircle className="size-5 animate-spin text-primary" />
              </div>
            ) : data.scholarships.length ? (
              <>
                <div className="grid gap-3 p-4 md:hidden">
                  {data.scholarships.map((item) => (
                    <ScholarshipCard
                      item={item}
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                    />
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1050px] text-sm">
                    <thead className="bg-muted/45 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3">Student</th>
                        <th className="px-4 py-3">Course</th>
                        <th className="px-4 py-3">Institute</th>
                        <th className="px-4 py-3">Progress</th>
                        <th className="px-4 py-3 text-right">Sanctioned</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.scholarships.map((item) => (
                        <tr
                          className="cursor-pointer hover:bg-muted/35"
                          key={item.id}
                          onClick={() => setSelectedId(item.id)}
                        >
                          <td className="px-5 py-4">
                            <p className="font-semibold">{item.studentName}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.admissionNumber || "No admission number"} ·{" "}
                              {item.beneficiaryCategory || "Category not recorded"}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <p>{item.courseName || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.courseCategory || "Uncategorised"}
                            </p>
                          </td>
                          <td className="max-w-64 px-4 py-4">
                            <p className="truncate">{item.instituteName || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.cityName || "City not recorded"}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            {item.annualDetailCount} annual records
                            <p className="text-xs text-muted-foreground">
                              {item.sanctionCount} sanctions
                            </p>
                          </td>
                          <td className="px-4 py-4 text-right font-semibold tabular-nums">
                            {money(item.sanctionedAmount)}
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge status={item.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="scholarship-report-controls flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
                  <span>{data.pagination.total.toLocaleString()} records</span>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={page <= 1}
                      onClick={() => setPage((value) => value - 1)}
                      size="sm"
                      variant="outline"
                    >
                      Previous
                    </Button>
                    <span>
                      {page} / {Math.max(1, data.pagination.totalPages)}
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
                </div>
              </>
            ) : (
              <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
                No scholarships match these filters.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <ScholarshipDetail
        activeSessionId={activeSessionId}
        onEdit={setEditor}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onSaved={saved}
        scholarshipId={selectedId}
        setup={setup}
      />
      <ScholarshipEditor
        activeSessionId={activeSessionId}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
        onSaved={(text) => {
          setEditor(null);
          saved(text);
        }}
        record={editor}
        searchPeople={loadSetup}
        setup={setup}
      />
      <ScholarshipSetup
        onOpenChange={setSetupOpen}
        onSaved={saved}
        open={setupOpen}
        setup={setup}
      />
      <ScholarshipReports
        activeSessionId={activeSessionId}
        onOpenChange={setReportsOpen}
        open={reportsOpen}
        sessions={setup?.sessions ?? []}
      />
    </main>
  );
}

function ScholarshipDetail({
  activeSessionId,
  onEdit,
  onOpenChange,
  onSaved,
  scholarshipId,
  setup,
}: {
  activeSessionId: string;
  onEdit: (record: Detail["record"]) => void;
  onOpenChange: (open: boolean) => void;
  onSaved: (text: string) => void;
  scholarshipId: string | null;
  setup: Setup | null;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [annual, setAnnual] = useState<Detail["annualDetails"][number] | "new" | null>(null);
  const [sanction, setSanction] = useState<Detail["sanctions"][number] | "new" | null>(null);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!scholarshipId) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(`/api/scholarships/${scholarshipId}`, { signal: controller.signal })
      .then(parse<Detail>)
      .then(setDetail)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(messageOf(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [key, scholarshipId]);
  function saved(text: string) {
    setAnnual(null);
    setSanction(null);
    setKey((value) => value + 1);
    onSaved(text);
  }
  return (
    <Sheet onOpenChange={onOpenChange} open={Boolean(scholarshipId)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-4xl">
        <div className="border-b px-6 py-5 pr-16">
          <SheetTitle>{detail?.record.studentName ?? "Scholarship record"}</SheetTitle>
          <SheetDescription>
            {detail
              ? `${detail.record.courseName} · ${detail.record.admissionNumber || "No admission number"}`
              : "Loading scholarship history…"}
          </SheetDescription>
        </div>
        {loading ? (
          <div className="grid min-h-72 place-items-center">
            <LoaderCircle className="animate-spin" />
          </div>
        ) : error ? (
          <p className="m-6 text-sm text-destructive">{error}</p>
        ) : detail ? (
          <div className="space-y-6 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.record.status} />
              {detail.record.courseCategory ? (
                <Badge variant="secondary">{detail.record.courseCategory}</Badge>
              ) : null}
              <div className="ml-auto">
                {detail.capabilities.manage ? (
                  <Button onClick={() => onEdit(detail.record)} size="sm" variant="outline">
                    <Pencil /> Edit record
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailCell label="Institute" value={String(detail.record.instituteName ?? "—")} />
              <DetailCell label="City" value={String(detail.record.cityName ?? "—")} />
              <DetailCell
                label="Admission year"
                value={String(detail.record.admissionYear ?? "—")}
              />
              <DetailCell label="Ledger" value={String(detail.record.ledgerNumber ?? "—")} />
            </div>
            <section>
              <SectionHeading
                action={detail.capabilities.manage ? () => setAnnual("new") : undefined}
                label="Annual progress"
              />
              <div className="divide-y rounded-xl border">
                {detail.annualDetails.length ? (
                  detail.annualDetails.map((item) => (
                    <button
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/30"
                      key={item.id}
                      onClick={() => detail.capabilities.manage && setAnnual(item)}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {item.studyYear} · {item.passed ? "Passed" : "Not passed"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.division || "Division not recorded"} · Fees {money(item.fees ?? 0)}
                        </p>
                      </div>
                      <p className="font-semibold tabular-nums">
                        {item.percentage == null ? "—" : `${item.percentage}%`}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="p-5 text-sm text-muted-foreground">No annual progress recorded.</p>
                )}
              </div>
            </section>
            <section>
              <SectionHeading
                action={detail.capabilities.manage ? () => setSanction("new") : undefined}
                label="Sanctions and allocations"
              />
              <div className="space-y-3">
                {detail.sanctions.length ? (
                  detail.sanctions.map((item) => (
                    <button
                      className="w-full rounded-xl border p-4 text-left hover:bg-muted/30"
                      key={item.id}
                      onClick={() => detail.capabilities.manage && setSanction(item)}
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-semibold">{formatDate(item.sanctionedOn)}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.paymentReference || "No payment reference"} · {item.lines.length}{" "}
                            allocations
                          </p>
                        </div>
                        <p className="font-semibold tabular-nums">{money(item.amount)}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.lines.map((line) => (
                          <Badge key={line.id} variant="secondary">
                            {line.headName}: {money(line.amount)}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="rounded-xl border p-5 text-sm text-muted-foreground">
                    No sanctions recorded.
                  </p>
                )}
              </div>
            </section>
            <AnnualEditor
              activeSessionId={activeSessionId}
              item={annual}
              onClose={() => setAnnual(null)}
              onSaved={saved}
              scholarshipId={detail.record.id}
              setup={setup}
            />
            <SanctionEditor
              activeSessionId={activeSessionId}
              item={sanction}
              onClose={() => setSanction(null)}
              onSaved={saved}
              scholarshipId={detail.record.id}
              setup={setup}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ScholarshipEditor({
  activeSessionId,
  onOpenChange,
  onSaved,
  record,
  searchPeople,
  setup,
}: {
  activeSessionId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (text: string) => void;
  record: Detail["record"] | "new" | null;
  searchPeople: (q?: string) => Promise<void>;
  setup: Setup | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [personId, setPersonId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [status, setStatus] = useState("active");
  const [personQuery, setPersonQuery] = useState("");
  useEffect(() => {
    if (!record) return;
    setPersonId(record === "new" ? "" : record.personId);
    setCourseId(record === "new" ? (setup?.courses[0]?.id ?? "") : record.courseId);
    setStatus(record === "new" ? "active" : record.status);
    setError("");
  }, [record, setup]);
  const selectedPerson = setup?.people.find((item) => item.id === personId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const value = {
      personId,
      sessionId: formText(form, "sessionId", activeSessionId),
      courseId,
      beneficiaryCategory: nullable(form.get("beneficiaryCategory")),
      studentName: formText(form, "studentName", selectedPerson?.name ?? ""),
      admissionNumber: nullable(form.get("admissionNumber")),
      fatherName: nullable(form.get("fatherName")),
      gender: nullable(form.get("gender")) || null,
      dateOfBirth: nullable(form.get("dateOfBirth")),
      classStream: nullable(form.get("classStream")),
      classPercentage: numberOrNull(form.get("classPercentage")),
      admissionYear: numberOrNull(form.get("admissionYear")),
      courseDuration: nullable(form.get("courseDuration")),
      collegeTraining: form.get("collegeTraining") === "on",
      cityName: nullable(form.get("cityName")),
      permanentAddress: nullable(form.get("permanentAddress")),
      mailingAddress: nullable(form.get("mailingAddress")),
      specialAllowance: form.get("specialAllowance") === "on",
      scholarshipAwarded: numberOrNull(form.get("scholarshipAwarded")),
      instituteName: nullable(form.get("instituteName")),
      bankAccountNumber: nullable(form.get("bankAccountNumber")),
      wardHealthRecord: nullable(form.get("wardHealthRecord")),
      needyCase: nullable(form.get("needyCase")),
      reason: nullable(form.get("reason")),
      status,
      phone: nullable(form.get("phone")),
      ledgerNumber: nullable(form.get("ledgerNumber")),
    };
    try {
      const response = await fetch(
        record === "new" ? "/api/scholarships" : `/api/scholarships/${record?.id}`,
        {
          method: record === "new" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(record === "new" ? value : { action: "record", value }),
        },
      );
      await parse(response);
      onSaved(record === "new" ? "Scholarship record created." : "Scholarship record updated.");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  const current = record === "new" ? null : record;
  return (
    <Sheet onOpenChange={onOpenChange} open={Boolean(record)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <div className="border-b px-6 py-5 pr-16">
          <SheetTitle>{record === "new" ? "New scholarship" : "Edit scholarship"}</SheetTitle>
          <SheetDescription>
            Maintain the beneficiary, course, institute, and award details.
          </SheetDescription>
        </div>
        <form className="space-y-5 p-6" onSubmit={(event) => void submit(event)}>
          {error ? (
            <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Find beneficiary</Label>
              <div className="flex gap-2">
                <Input
                  onChange={(e) => setPersonQuery(e.target.value)}
                  placeholder="Search name or admission number"
                  value={personQuery}
                />
                <Button
                  onClick={() => void searchPeople(personQuery)}
                  type="button"
                  variant="outline"
                >
                  Search
                </Button>
              </div>
              <SimpleSelect
                label="Beneficiary"
                onChange={setPersonId}
                options={(setup?.people ?? []).map((item) => ({
                  id: item.id,
                  name: `${item.name} · ${item.admissionNumber}`,
                }))}
                value={personId}
              />
            </div>
            <FormInput
              defaultValue={String(current?.studentName ?? selectedPerson?.name ?? "")}
              label="Student name"
              name="studentName"
              required
            />
            <FormInput
              defaultValue={String(
                current?.admissionNumber ?? selectedPerson?.admissionNumber ?? "",
              )}
              label="Admission number"
              name="admissionNumber"
            />
            <SimpleSelect
              label="Course"
              onChange={setCourseId}
              options={setup?.courses ?? []}
              value={courseId}
            />
            <SimpleSelect
              label="Academic session"
              name="sessionId"
              options={setup?.sessions ?? []}
              value={String(current?.sessionId ?? activeSessionId)}
            />
            <FormInput
              defaultValue={String(current?.beneficiaryCategory ?? "")}
              label="Beneficiary category"
              name="beneficiaryCategory"
            />
            <FormInput
              defaultValue={String(current?.fatherName ?? "")}
              label="Father name"
              name="fatherName"
            />
            <FormInput
              defaultValue={String(current?.instituteName ?? "")}
              label="Institute"
              name="instituteName"
            />
            <FormInput
              defaultValue={String(current?.cityName ?? "")}
              label="City"
              name="cityName"
            />
            <FormInput
              defaultValue={String(current?.admissionYear ?? "")}
              label="Admission year"
              name="admissionYear"
              type="number"
            />
            <FormInput
              defaultValue={String(current?.courseDuration ?? "")}
              label="Course duration"
              name="courseDuration"
            />
            <FormInput
              defaultValue={String(current?.classStream ?? "")}
              label="Class / stream"
              name="classStream"
            />
            <FormInput
              defaultValue={String(current?.classPercentage ?? "")}
              label="Entry percentage"
              name="classPercentage"
              type="number"
            />
            <FormInput
              defaultValue={String(current?.scholarshipAwarded ?? "")}
              label="Scholarship awarded"
              name="scholarshipAwarded"
              type="number"
            />
            <FormInput
              defaultValue={String(current?.bankAccountNumber ?? "")}
              label="Bank account"
              name="bankAccountNumber"
            />
            <FormInput defaultValue={String(current?.phone ?? "")} label="Phone" name="phone" />
            <FormInput
              defaultValue={String(current?.ledgerNumber ?? "")}
              label="Ledger number"
              name="ledgerNumber"
            />
            <SimpleSelect
              label="Status"
              onChange={setStatus}
              options={[
                { id: "active", name: "Active" },
                { id: "closed", name: "Closed" },
              ]}
              value={status}
            />
            <FormInput
              defaultValue={String(current?.reason ?? "")}
              label="Reason / notes"
              name="reason"
            />
          </div>
          <div className="flex justify-end gap-2 border-t pt-5">
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={busy || !personId || !courseId} type="submit">
              {busy ? <LoaderCircle className="animate-spin" /> : null} Save scholarship
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function AnnualEditor({
  activeSessionId,
  item,
  onClose,
  onSaved,
  scholarshipId,
  setup,
}: {
  activeSessionId: string;
  item: Detail["annualDetails"][number] | "new" | null;
  onClose: () => void;
  onSaved: (text: string) => void;
  scholarshipId: string;
  setup: Setup | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const value = {
      id: item === "new" ? undefined : item?.id,
      sessionId: formText(form, "sessionId", activeSessionId),
      studyYear: formText(form, "studyYear"),
      passed: form.get("passed") === "yes",
      percentage: numberOrNull(form.get("percentage")),
      division: nullable(form.get("division")),
      fees: numberOrNull(form.get("fees")),
      remarks: nullable(form.get("remarks")),
    };
    try {
      await fetch(`/api/scholarships/${scholarshipId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "annual", value }),
      }).then(parse);
      onSaved(item === "new" ? "Annual progress added." : "Annual progress updated.");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet onOpenChange={(open) => !open && onClose()} open={Boolean(item)}>
      <SheetContent className="w-full sm:max-w-lg">
        <div className="border-b px-6 py-5 pr-16">
          <SheetTitle>Annual progress</SheetTitle>
        </div>
        <form className="space-y-4 p-6" onSubmit={(e) => void submit(e)}>
          <SimpleSelect
            label="Session"
            name="sessionId"
            options={setup?.sessions ?? []}
            value={item === "new" ? activeSessionId : String(item?.sessionId ?? activeSessionId)}
          />
          <FormInput
            defaultValue={item === "new" ? "" : item?.studyYear}
            label="Study year"
            name="studyYear"
            required
          />
          <SimpleSelect
            label="Result"
            name="passed"
            options={[
              { id: "yes", name: "Passed" },
              { id: "no", name: "Not passed" },
            ]}
            value={item === "new" || item?.passed ? "yes" : "no"}
          />
          <FormInput
            defaultValue={item === "new" ? "" : String(item?.percentage ?? "")}
            label="Percentage"
            name="percentage"
            type="number"
          />
          <FormInput
            defaultValue={item === "new" ? "" : String(item?.division ?? "")}
            label="Division"
            name="division"
          />
          <FormInput
            defaultValue={item === "new" ? "" : String(item?.fees ?? "")}
            label="Fees"
            name="fees"
            type="number"
          />
          <FormInput
            defaultValue={item === "new" ? "" : String(item?.remarks ?? "")}
            label="Remarks"
            name="remarks"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" disabled={busy} type="submit">
            Save annual progress
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SanctionEditor({
  activeSessionId,
  item,
  onClose,
  onSaved,
  scholarshipId,
  setup,
}: {
  activeSessionId: string;
  item: Detail["sanctions"][number] | "new" | null;
  onClose: () => void;
  onSaved: (text: string) => void;
  scholarshipId: string;
  setup: Setup | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lines, setLines] = useState<
    Array<{ headId: string; cityName: string; amount: string; advanceOn: string }>
  >([]);
  useEffect(() => {
    if (!item) return;
    setError("");
    setLines(
      item === "new"
        ? [{ headId: setup?.heads[0]?.id ?? "", cityName: "", amount: "", advanceOn: "" }]
        : item.lines.map((line) => ({
            headId: line.headId,
            cityName: line.cityName ?? "",
            amount: String(line.amount),
            advanceOn: line.advanceOn ?? "",
          })),
    );
  }, [item, setup]);
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    [lines],
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const value = {
      id: item === "new" ? undefined : item?.id,
      sessionId: formText(form, "sessionId", activeSessionId),
      amount: numberOrNull(form.get("amount")) ?? total,
      sanctionedOn: formText(form, "sanctionedOn"),
      periodFrom: nullable(form.get("periodFrom")),
      periodTo: nullable(form.get("periodTo")),
      paymentReference: nullable(form.get("paymentReference")),
      inFavourOf: nullable(form.get("inFavourOf")),
      remarks: nullable(form.get("remarks")),
      lines: lines.map((line) => ({
        headId: line.headId,
        cityName: line.cityName || null,
        amount: Number(line.amount),
        advanceOn: line.advanceOn || null,
      })),
    };
    try {
      await fetch(`/api/scholarships/${scholarshipId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sanction", value }),
      }).then(parse);
      onSaved(item === "new" ? "Sanction created." : "Sanction updated.");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet onOpenChange={(open) => !open && onClose()} open={Boolean(item)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <div className="border-b px-6 py-5 pr-16">
          <SheetTitle>Scholarship sanction</SheetTitle>
          <SheetDescription>Record the approval and its head-level allocation.</SheetDescription>
        </div>
        <form className="space-y-5 p-6" onSubmit={(e) => void submit(e)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SimpleSelect
              label="Session"
              name="sessionId"
              options={setup?.sessions ?? []}
              value={item === "new" ? activeSessionId : String(item?.sessionId ?? activeSessionId)}
            />
            <FormInput
              defaultValue={
                item === "new" ? new Date().toISOString().slice(0, 10) : item?.sanctionedOn
              }
              label="Sanctioned on"
              name="sanctionedOn"
              required
              type="date"
            />
            <FormInput
              defaultValue={item === "new" ? "" : String(item?.amount ?? "")}
              label={`Approved amount · allocations ${money(total)}`}
              name="amount"
              required
              type="number"
            />
            <FormInput
              defaultValue={item === "new" ? "" : String(item?.paymentReference ?? "")}
              label="Cheque / payment reference"
              name="paymentReference"
            />
            <FormInput
              defaultValue={item === "new" ? "" : String(item?.periodFrom ?? "")}
              label="Period from"
              name="periodFrom"
              type="date"
            />
            <FormInput
              defaultValue={item === "new" ? "" : String(item?.periodTo ?? "")}
              label="Period to"
              name="periodTo"
              type="date"
            />
            <FormInput
              defaultValue={item === "new" ? "" : String(item?.inFavourOf ?? "")}
              label="In favour of"
              name="inFavourOf"
            />
            <FormInput
              defaultValue={item === "new" ? "" : String(item?.remarks ?? "")}
              label="Remarks"
              name="remarks"
            />
          </div>
          <div>
            <SectionHeading
              action={() =>
                setLines((value) => [
                  ...value,
                  { headId: setup?.heads[0]?.id ?? "", cityName: "", amount: "", advanceOn: "" },
                ])
              }
              label="Allocations"
            />
            <div className="space-y-3">
              {lines.map((line, index) => (
                <div
                  className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_120px_150px_auto]"
                  key={index}
                >
                  <SimpleSelect
                    label="Head"
                    onChange={(headId) =>
                      setLines((value) =>
                        value.map((item, i) => (i === index ? { ...item, headId } : item)),
                      )
                    }
                    options={setup?.heads ?? []}
                    value={line.headId}
                  />
                  <Input
                    aria-label="City"
                    onChange={(e) =>
                      setLines((value) =>
                        value.map((item, i) =>
                          i === index ? { ...item, cityName: e.target.value } : item,
                        ),
                      )
                    }
                    placeholder="City"
                    value={line.cityName}
                  />
                  <Input
                    aria-label="Amount"
                    min="0"
                    onChange={(e) =>
                      setLines((value) =>
                        value.map((item, i) =>
                          i === index ? { ...item, amount: e.target.value } : item,
                        ),
                      )
                    }
                    placeholder="Amount"
                    type="number"
                    value={line.amount}
                  />
                  <Input
                    aria-label="Advance date"
                    onChange={(e) =>
                      setLines((value) =>
                        value.map((item, i) =>
                          i === index ? { ...item, advanceOn: e.target.value } : item,
                        ),
                      )
                    }
                    type="date"
                    value={line.advanceOn}
                  />
                  <Button
                    disabled={lines.length === 1}
                    onClick={() => setLines((value) => value.filter((_, i) => i !== index))}
                    type="button"
                    variant="ghost"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            className="w-full"
            disabled={busy || lines.some((line) => !line.headId || !line.amount)}
            type="submit"
          >
            Save sanction
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ScholarshipSetup({
  onOpenChange,
  onSaved,
  open,
  setup,
}: {
  onOpenChange: (open: boolean) => void;
  onSaved: (text: string) => void;
  open: boolean;
  setup: Setup | null;
}) {
  const [kind, setKind] = useState("courseCategory");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function editSetup(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await fetch("/api/scholarships/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(parse);
      onSaved("Scholarship setup record updated.");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    let body: Record<string, unknown> = { kind };
    if (kind === "courseCategory" || kind === "head") body = { ...body, name: form.get("name") };
    else if (kind === "course")
      body = { ...body, name: form.get("name"), categoryId: form.get("categoryId") };
    else if (kind === "limit")
      body = {
        ...body,
        courseGroup: form.get("courseGroup"),
        headName: form.get("headName"),
        amount: numberOrNull(form.get("amount")),
      };
    else
      body = {
        ...body,
        sessionId: form.get("sessionId"),
        cityName: form.get("cityName"),
        amount: Number(form.get("amount")),
      };
    try {
      await fetch("/api/scholarships/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(parse);
      onSaved("Scholarship setup updated.");
      event.currentTarget.reset();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <div className="border-b px-6 py-5 pr-16">
          <SheetTitle>Scholarship setup</SheetTitle>
          <SheetDescription>
            Courses, categories, heads, limits, and city advances.
          </SheetDescription>
        </div>
        <div className="space-y-6 p-6">
          <SimpleSelect
            label="Setup area"
            onChange={setKind}
            options={[
              { id: "courseCategory", name: "Course category" },
              { id: "course", name: "Course" },
              { id: "head", name: "Scholarship head" },
              { id: "limit", name: "Policy limit" },
              { id: "cityAdvance", name: "City advance" },
            ]}
            value={kind}
          />
          <form
            className="space-y-4 rounded-2xl border bg-muted/20 p-5"
            onSubmit={(e) => void submit(e)}
          >
            {kind === "courseCategory" || kind === "head" ? (
              <FormInput label="Name" name="name" required />
            ) : kind === "course" ? (
              <>
                <FormInput label="Course name" name="name" required />
                <SimpleSelect
                  label="Category"
                  name="categoryId"
                  options={setup?.categories ?? []}
                  value={setup?.categories[0]?.id ?? ""}
                />
              </>
            ) : kind === "limit" ? (
              <>
                <FormInput label="Course group" name="courseGroup" required />
                <FormInput label="Head name" name="headName" required />
                <FormInput label="Amount" name="amount" type="number" />
              </>
            ) : (
              <>
                <SimpleSelect
                  label="Session"
                  name="sessionId"
                  options={setup?.sessions ?? []}
                  value={setup?.sessions[0]?.id ?? ""}
                />
                <FormInput label="City" name="cityName" required />
                <FormInput label="Amount" name="amount" required type="number" />
              </>
            )}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button disabled={busy} type="submit">
              <Plus /> Add setup record
            </Button>
          </form>
          <div className="grid gap-4 sm:grid-cols-2">
            <SetupList
              label="Categories"
              onEdit={(index) => {
                const item = setup?.categories[index];
                const name = item && window.prompt("Course category name", item.name);
                if (item && name) void editSetup({ kind: "courseCategory", id: item.id, name });
              }}
              values={setup?.categories.map((item) => item.name) ?? []}
            />
            <SetupList
              label="Courses"
              onEdit={(index) => {
                const item = setup?.courses[index];
                const name = item && window.prompt("Course name", item.name);
                if (item && name)
                  void editSetup({
                    kind: "course",
                    id: item.id,
                    categoryId: item.categoryId,
                    name,
                  });
              }}
              values={setup?.courses.map((item) => item.name) ?? []}
            />
            <SetupList
              label="Heads"
              onEdit={(index) => {
                const item = setup?.heads[index];
                const name = item && window.prompt("Scholarship head name", item.name);
                if (item && name) void editSetup({ kind: "head", id: item.id, name });
              }}
              values={setup?.heads.map((item) => item.name) ?? []}
            />
            <SetupList
              label="Limits"
              onEdit={(index) => {
                const item = setup?.limits[index];
                const amount =
                  item && window.prompt("Policy limit amount", String(item.amount ?? ""));
                if (item && amount !== null)
                  void editSetup({
                    kind: "limit",
                    id: item.id,
                    courseGroup: item.courseGroup,
                    headName: item.headName,
                    amount: amount ? Number(amount) : null,
                  });
              }}
              values={
                setup?.limits.map(
                  (item) => `${item.courseGroup} · ${item.headName} · ${money(item.amount ?? 0)}`,
                ) ?? []
              }
            />
            <SetupList
              label="City advances"
              onEdit={(index) => {
                const item = setup?.cityAdvances[index];
                const amount = item && window.prompt("City advance amount", String(item.amount));
                if (item && amount)
                  void editSetup({
                    kind: "cityAdvance",
                    id: item.id,
                    sessionId: item.sessionId,
                    cityName: item.cityName,
                    amount: Number(amount),
                  });
              }}
              values={
                setup?.cityAdvances.map((item) => `${item.cityName} · ${money(item.amount)}`) ?? []
              }
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ScholarshipReports({
  activeSessionId,
  onOpenChange,
  open,
  sessions,
}: {
  activeSessionId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  sessions: Array<{ id: string; name: string }>;
}) {
  const [report, setReport] = useState("students");
  const [session, setSession] = useState(activeSessionId || "all");
  const [data, setData] = useState<ScholarshipReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(`/api/scholarships/reports?${new URLSearchParams({ report, session })}`, {
      signal: controller.signal,
    })
      .then(parse<ScholarshipReport>)
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(messageOf(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, report, session]);
  function exportReport() {
    if (!data) return;
    downloadCsv(`scholarship-${data.report}`, [
      data.columns.map((column) => column.label),
      ...data.rows.map((row) => data.columns.map((column) => String(row[column.key] ?? ""))),
    ]);
  }
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="scholarship-report-portal w-full overflow-y-auto sm:max-w-5xl">
        <div className="border-b px-6 py-5 pr-16">
          <SheetTitle>Scholarship reports</SheetTitle>
          <SheetDescription>
            The six reports available in the legacy scholarship report center.
          </SheetDescription>
        </div>
        <div className="space-y-5 p-6">
          <div className="scholarship-report-controls grid gap-3 md:grid-cols-[1fr_260px_auto_auto] md:items-end">
            <SimpleSelect
              label="Report"
              onChange={setReport}
              options={[
                { id: "students", name: "Scholarship students" },
                { id: "ledger", name: "Scholarship ledger" },
                { id: "courseCompleted", name: "Course completed" },
                { id: "newStudents", name: "New students" },
                { id: "placeWise", name: "Student place-wise" },
                { id: "yearWise", name: "Student year-wise" },
              ]}
              value={report}
            />
            <SimpleSelect
              label="Academic session"
              onChange={setSession}
              options={[{ id: "all", name: "All sessions" }, ...sessions]}
              value={session}
            />
            <Button disabled={!data || loading} onClick={exportReport} variant="outline">
              <Download /> CSV
            </Button>
            <Button disabled={!data || loading} onClick={() => window.print()} variant="outline">
              <Printer /> Print
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="scholarship-legacy-report rounded-2xl border bg-background">
            {loading ? (
              <div className="grid min-h-64 place-items-center">
                <LoaderCircle className="animate-spin" />
              </div>
            ) : data ? (
              <>
                <div className="border-b p-5">
                  <p className="text-lg font-semibold">{data.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {data.sessionName} · {data.rows.length.toLocaleString()} rows
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        {data.columns.map((column) => (
                          <th
                            className={`px-4 py-3 ${column.numeric ? "text-right" : ""}`}
                            key={column.key}
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.rows.map((row, index) => (
                        <tr key={index}>
                          {data.columns.map((column) => (
                            <td
                              className={`px-4 py-3 ${column.numeric ? "text-right tabular-nums" : ""}`}
                              key={column.key}
                            >
                              {column.numeric && /amount|awarded/i.test(column.key)
                                ? money(Number(row[column.key] ?? 0))
                                : String(row[column.key] ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.rows.length ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">
                      No records for this report and session.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <Icon className="size-4 text-primary" />
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
function ScholarshipCard({ item, onClick }: { item: Scholarship; onClick: () => void }) {
  return (
    <button className="rounded-2xl border p-4 text-left" onClick={onClick}>
      <div className="flex justify-between gap-3">
        <div>
          <p className="font-semibold">{item.studentName}</p>
          <p className="text-xs text-muted-foreground">
            {item.admissionNumber || "No admission number"}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <p className="mt-3 text-sm">{item.courseName || "Course not recorded"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {item.annualDetailCount} annual records · {item.sanctionCount} sanctions ·{" "}
        {money(item.sanctionedAmount)}
      </p>
    </button>
  );
}
function StatusBadge({ status }: { status: "active" | "closed" }) {
  return (
    <Badge variant={status === "active" ? "default" : "secondary"}>
      {status === "active" ? "Active" : "Closed"}
    </Badge>
  );
}
function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/15 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
function SectionHeading({ action, label }: { action?: () => void; label: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold">{label}</h3>
      {action ? (
        <Button onClick={action} size="sm" type="button" variant="outline">
          <Plus /> Add
        </Button>
      ) : null}
    </div>
  );
}
function SimpleSelect({
  label,
  name,
  onChange,
  options,
  value,
}: {
  label: string;
  name?: string;
  onChange?: (value: string) => void;
  options: Array<{ id: string; name: string }>;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        name={name}
        {...(onChange ? { onValueChange: onChange, value } : { defaultValue: value })}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function FormInput({
  label,
  name,
  ...props
}: {
  label: string;
  name: string;
  [key: string]: unknown;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`scholarship-${name}`}>{label}</Label>
      <Input id={`scholarship-${name}`} name={name} {...props} />
    </div>
  );
}
function SetupList({
  label,
  onEdit,
  values,
}: {
  label: string;
  onEdit?: (index: number) => void;
  values: string[];
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm font-semibold">{label}</p>
      <div className="mt-3 max-h-48 space-y-1 overflow-auto text-xs text-muted-foreground">
        {values.map((value, index) => (
          <div className="flex items-center justify-between gap-2" key={`${value}:${index}`}>
            <span>{value}</span>
            {onEdit ? (
              <button
                aria-label={`Edit ${value}`}
                className="rounded p-1 text-primary hover:bg-primary/10"
                onClick={() => onEdit(index)}
                type="button"
              >
                <Pencil className="size-3" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
function nullable(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function numberOrNull(value: FormDataEntryValue | null) {
  const text = nullable(value);
  return text === null ? null : Number(text);
}
function formText(form: FormData, name: string, fallback = "") {
  const value = form.get(name);
  return typeof value === "string" && value ? value : fallback;
}
function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}
function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
function downloadCsv(name: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
async function parse<T = unknown>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Scholarship request failed.");
  return body;
}
function messageOf(reason: unknown) {
  return reason instanceof Error ? reason.message : "Scholarship request failed.";
}
