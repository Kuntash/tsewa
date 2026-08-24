import {
  ArrowLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Printer,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
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

type AcademicSession = { id: string; name: string; startsOn: string; endsOn: string };
type ReportDomain = "scholarship" | "sponsorship";

export type ReportsFilters = {
  domain?: ReportDomain;
  report?: string;
  session?: string;
  q?: string;
};

type ReportDefinition = {
  id: string;
  domain: ReportDomain;
  name: string;
  description: string;
};

type ReportData = {
  generatedAt: string;
  report: string;
  title: string;
  sessionName: string;
  columns: Array<{ key: string; label: string; numeric?: boolean }>;
  rows: Array<Record<string, unknown>>;
};

const reports: ReportDefinition[] = [
  {
    id: "students",
    domain: "scholarship",
    name: "Scholarship students",
    description: "Current student awards, courses, institutes, and status.",
  },
  {
    id: "ledger",
    domain: "scholarship",
    name: "Scholarship ledger",
    description: "Sanction lines by student, head, date, and amount.",
  },
  {
    id: "placeWise",
    domain: "scholarship",
    name: "Place-wise summary",
    description: "Student and award totals grouped by place.",
  },
  {
    id: "yearWise",
    domain: "scholarship",
    name: "Year-wise summary",
    description: "Students grouped by course category and study year.",
  },
  {
    id: "sponsors",
    domain: "sponsorship",
    name: "Sponsors list",
    description: "Sponsor contacts, organisation, category, and beneficiaries.",
  },
  {
    id: "organizationWise",
    domain: "sponsorship",
    name: "Sponsors by organisation",
    description: "Beneficiaries grouped by sponsoring organisation.",
  },
  {
    id: "completionStudent",
    domain: "sponsorship",
    name: "Student completion",
    description: "Completed and discontinued student sponsorships.",
  },
  {
    id: "caseHistoryStudent",
    domain: "sponsorship",
    name: "Student case history",
    description: "Student sponsorship history with status and remarks.",
  },
  {
    id: "caseHistoryElderly",
    domain: "sponsorship",
    name: "Elderly case history",
    description: "Elderly sponsorship history with status and remarks.",
  },
  {
    id: "giftMoney",
    domain: "sponsorship",
    name: "Gift money",
    description: "Gift receipts, allocations, and beneficiary totals.",
  },
  {
    id: "payments",
    domain: "sponsorship",
    name: "Sponsorship payments",
    description: "All sponsorship remittances and allocations.",
  },
];

export function ReportsCentre({
  activeSessionId,
  filters = {},
  onBack,
  onFiltersChange,
  sessions,
}: {
  activeSessionId: string;
  filters?: ReportsFilters;
  onBack: () => void;
  onFiltersChange?: (filters: ReportsFilters) => void;
  sessions: AcademicSession[];
}) {
  const [query, setQuery] = useState(filters.q ?? "");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selected = reports.find(
    (item) => item.domain === filters.domain && item.id === filters.report,
  );
  const selectedSession = filters.session ?? activeSessionId;
  const visibleReports = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? reports.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(needle))
      : reports;
  }, [query]);

  useEffect(() => setQuery(filters.q ?? ""), [filters.q]);
  useEffect(() => {
    if (!selected) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    const endpoint =
      selected.domain === "scholarship" ? "/api/scholarships/reports" : "/api/sponsorship/reports";
    setLoading(true);
    setError("");
    void fetch(
      `${endpoint}?${new URLSearchParams({ report: selected.id, session: selectedSession })}`,
      {
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        const payload = (await response.json()) as ReportData & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "The report could not be generated.");
        return payload;
      })
      .then(setData)
      .catch((reason: unknown) => {
        if ((reason as { name?: string }).name !== "AbortError") {
          setError(reason instanceof Error ? reason.message : "The report could not be generated.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selected, selectedSession]);

  function chooseReport(report: ReportDefinition) {
    onFiltersChange?.({
      domain: report.domain,
      report: report.id,
      session: selectedSession,
      q: query || undefined,
    });
  }

  function changeQuery(value: string) {
    setQuery(value);
    onFiltersChange?.({ ...filters, q: value || undefined });
  }

  async function recordExport(format: "csv" | "pdf") {
    if (!data || !selected) return false;
    const response = await fetch("/api/reports/exports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        domain: selected.domain,
        report: data.report,
        session: selectedSession,
        format,
        rowCount: data.rows.length,
      }),
    });
    if (!response.ok) {
      setError("The export could not be recorded in the audit trail. Please try again.");
      return false;
    }
    return true;
  }

  async function exportCsv() {
    if (!data) return;
    if (!(await recordExport("csv"))) return;
    const values = [
      data.columns.map((column) => column.label),
      ...data.rows.map((row) => data.columns.map((column) => printable(row[column.key]))),
    ];
    const csv = values.map((row) => row.map(csvCell).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${data.report}-${selectedSession}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function printReport() {
    if (await recordExport("pdf")) window.print();
  }

  return (
    <main className="min-h-svh bg-muted/30">
      <header className="reports-no-print sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 md:px-8">
          <Button aria-label="Back to dashboard" onClick={onBack} size="icon" variant="ghost">
            <ArrowLeft />
          </Button>
          <div>
            <p className="font-semibold tracking-tight">Reports</p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Preview, filter, and export operational records
            </p>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-7 md:px-8 lg:py-10">
        {!selected ? (
          <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
              <div>
                <p className="text-sm font-medium text-primary">Report catalogue</p>
                <h1 className="mt-1 max-w-3xl text-3xl font-semibold tracking-[-0.04em] md:text-4xl">
                  One place for operational reporting.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Every selection is reflected in the URL, so a filtered report can be bookmarked or
                  shared with another authorized member.
                </p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 bg-background pl-9"
                  onChange={(event) => changeQuery(event.target.value)}
                  placeholder="Find a report"
                  value={query}
                />
              </div>
            </div>
            {(["scholarship", "sponsorship"] as const).map((domain) => {
              const items = visibleReports.filter((item) => item.domain === domain);
              if (!items.length) return null;
              return (
                <section className="mt-9" key={domain}>
                  <div className="mb-3 flex items-center gap-3">
                    <h2 className="text-lg font-semibold capitalize">{domain}</h2>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((item) => (
                      <button
                        className="group min-w-0 rounded-2xl border bg-background p-5 text-left transition-colors hover:border-primary/35 hover:bg-primary/[0.025]"
                        key={`${item.domain}-${item.id}`}
                        onClick={() => chooseReport(item)}
                        type="button"
                      >
                        <div className="flex items-start gap-4">
                          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                            <FileSpreadsheet className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{item.name}</p>
                            <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                          <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        ) : (
          <section className="reports-print-area">
            <div className="reports-no-print flex flex-col gap-5 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Button
                  className="-ml-3 mb-3"
                  onClick={() => onFiltersChange?.({ q: query || undefined })}
                  size="sm"
                  variant="ghost"
                >
                  <ArrowLeft /> Report catalogue
                </Button>
                <p className="text-sm font-medium capitalize text-primary">{selected.domain}</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">{selected.name}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{selected.description}</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Select
                  onValueChange={(session) => onFiltersChange?.({ ...filters, session })}
                  value={selectedSession}
                >
                  <SelectTrigger className="w-[220px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="all">All sessions</SelectItem>
                  </SelectContent>
                </Select>
                <Button disabled={!data} onClick={() => void exportCsv()} variant="outline">
                  <Download /> CSV
                </Button>
                <Button disabled={!data} onClick={() => void printReport()}>
                  <Printer /> Print / PDF
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="grid min-h-72 place-items-center">
                <LoaderCircle className="size-5 animate-spin text-primary" />
              </div>
            ) : error ? (
              <Card className="mt-6 border-destructive/25">
                <CardContent className="p-5 text-sm text-destructive">{error}</CardContent>
              </Card>
            ) : data ? (
              <div className="mt-6 overflow-hidden rounded-2xl border bg-background">
                <div className="border-b px-5 py-4">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    <h2 className="font-semibold">{data.title}</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.sessionName} · {data.rows.length.toLocaleString()} rows · Generated{" "}
                    {new Date(data.generatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/55">
                        {data.columns.map((column) => (
                          <th
                            className={`border-b px-4 py-3 text-left text-xs font-semibold ${column.numeric ? "text-right" : ""}`}
                            key={column.key}
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row, index) => (
                        <tr className="border-b last:border-0" key={index}>
                          {data.columns.map((column) => (
                            <td
                              className={`px-4 py-3 align-top ${column.numeric ? "text-right tabular-nums" : ""}`}
                              key={column.key}
                            >
                              {printable(row[column.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.rows.length ? (
                    <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">
                      No records for this report and session.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}

function printable(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value);
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
