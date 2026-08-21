import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  LoaderCircle,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRoundSearch,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PersonProfileSheet } from "@/components/person-profile-sheet";
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
import { authClient } from "@/lib/auth-client";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type HealthVisit = {
  id: string;
  personId: string | null;
  patientName: string;
  patientKind: "child" | "elderly" | "staff" | "other";
  admissionNumber: string | null;
  gender: string | null;
  homeName: string | null;
  ageAtVisit: number | null;
  checkupDate: string;
  admittedOn: string | null;
  dischargedOn: string | null;
  doctorName: string | null;
  referredTo: string | null;
  referralLocation: string | null;
  remarks: string | null;
  diagnoses: Array<{
    id: string;
    name: string;
    recordedOn: string | null;
    remarks: string | null;
  }>;
};

type HealthResponse = {
  summary: {
    visits: number;
    diagnoses: number;
    linkedPeople: number;
    firstVisitOn: string | null;
    lastVisitOn: string | null;
  };
  visits: HealthVisit[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type TbCase = {
  id: string;
  personId: string | null;
  patientName: string;
  patientKind: "child" | "elderly" | "staff" | "other";
  tbCardNumber: string | null;
  admissionNumber: string | null;
  fatherName: string | null;
  gender: string | null;
  ageAtRegistration: number | null;
  homeName: string | null;
  treatmentRegimen: string | null;
  registrationDate: string;
  treatmentStartDate: string | null;
  treatmentEndDate: string | null;
  outcome: string | null;
  tbType: string | null;
  caseType: string | null;
  remarks: string | null;
  details: Array<{
    id: string;
    recordedOn: string;
    testName: string;
    result: string | null;
    remarks: string | null;
  }>;
};

type TbResponse = {
  summary: {
    cases: number;
    details: number;
    linkedPeople: number;
    onTreatment: number;
    firstRegistrationOn: string | null;
    lastRegistrationOn: string | null;
  };
  outcomes: Array<{ name: string; count: number }>;
  cases: TbCase[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type MedicalAdvance = {
  id: string;
  sanctionedOn: string;
  nurseName: string | null;
  sanctionNumber: string | null;
  advanceAmount: number;
  referringDoctorName: string | null;
  referralLocation: string | null;
  remarks: string | null;
  details: Array<{
    id: string;
    personId: string | null;
    patientName: string;
    patientKind: "child" | "elderly" | "staff" | "other";
    sanctionType: string;
    homeName: string | null;
    ageAtSanction: number | null;
    medication: string | null;
    referredToDoctorName: string | null;
    hospitalRegistrationNumber: string | null;
    hospitalReferredTo: string | null;
    hospitalAdmitted: string | null;
    diagnosis: string | null;
    admittedOn: string | null;
    dischargedOn: string | null;
    surgeryType: string | null;
    amount: number | null;
    remarks: string | null;
  }>;
  settlements: Array<{
    id: string;
    settledOn: string;
    billNumber: string | null;
    nurseTada: number | null;
    totalExpenses: number | null;
    extraExpenses: number | null;
    balance: number | null;
    remarks: string | null;
  }>;
};

type MedicalAdvanceResponse = {
  summary: {
    advances: number;
    advanceAmount: number;
    patientAllocations: number;
    settlements: number;
    settlementLinks: number;
    totalExpenses: number;
    firstSanctionOn: string | null;
    lastSanctionOn: string | null;
  };
  advances: MedicalAdvance[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const emptyHealth: HealthResponse = {
  summary: { visits: 0, diagnoses: 0, linkedPeople: 0, firstVisitOn: null, lastVisitOn: null },
  visits: [],
  pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
};

export type HealthFilters = {
  section?: "diagnosis" | "tb" | "advances";
  q?: string;
  kind?: "all" | "child" | "elderly" | "staff" | "other";
  outcome?: string;
  settlement?: string;
  page?: number;
};

export function HealthOperations({
  filters = {},
  onBack,
  onFiltersChange,
}: {
  filters?: HealthFilters;
  onBack: () => void;
  onFiltersChange?: (filters: HealthFilters) => void;
}) {
  const [section, setSection] = useState<"diagnosis" | "tb" | "advances">(
    filters.section ?? "diagnosis",
  );
  const [query, setQuery] = useState(filters.q ?? "");
  const debouncedQuery = useDebouncedValue(query);
  const [kind, setKind] = useState(filters.kind ?? "all");
  const [page, setPage] = useState(filters.page ?? 1);
  const [data, setData] = useState<HealthResponse>(emptyHealth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  useEffect(() => {
    setSection(filters.section ?? "diagnosis");
    setQuery(filters.q ?? "");
    setKind(filters.kind ?? "all");
    setPage(filters.page ?? 1);
  }, [filters.kind, filters.page, filters.q, filters.section]);

  useEffect(() => {
    if (section === "diagnosis") {
      onFiltersChange?.({ section, q: debouncedQuery || undefined, kind, page });
    }
  }, [debouncedQuery, kind, onFiltersChange, page, section]);

  useEffect(() => setPage(1), [debouncedQuery, kind]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const parameters = new URLSearchParams({
      q: debouncedQuery,
      kind,
      page: String(page),
      pageSize: "25",
    });
    void fetch(`/api/health/history?${parameters}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as HealthResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Health history could not be loaded.");
        setData(payload);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Health history could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedQuery, kind, page]);

  return (
    <main className="min-h-svh bg-muted/35">
      <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-background/95 px-5 backdrop-blur md:px-8">
        <Button aria-label="Back to home" onClick={onBack} size="icon" variant="ghost">
          <ArrowLeft />
        </Button>
        <div className="ml-3">
          <p className="text-sm font-semibold">Health</p>
          <p className="text-xs text-muted-foreground">Restricted clinical history</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button
            onClick={() => void authClient.signOut().then(() => window.location.reload())}
            variant="ghost"
          >
            Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <div className="mb-7 flex w-fit gap-1 rounded-full border bg-background p-1">
          <Button
            aria-pressed={section === "diagnosis"}
            onClick={() => setSection("diagnosis")}
            size="sm"
            variant={section === "diagnosis" ? "default" : "ghost"}
          >
            Diagnosis history
          </Button>
          <Button
            aria-pressed={section === "tb"}
            onClick={() => setSection("tb")}
            size="sm"
            variant={section === "tb" ? "default" : "ghost"}
          >
            TB register
          </Button>
          <Button
            aria-pressed={section === "advances"}
            onClick={() => setSection("advances")}
            size="sm"
            variant={section === "advances" ? "default" : "ghost"}
          >
            Medical advances
          </Button>
        </div>
        {section === "diagnosis" ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <ShieldCheck className="size-4" /> Protected by health.read
                </div>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">
                  Diagnosis history
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Preserved visits and diagnoses from the legacy dispensary records. This first
                  parity slice is read-only; medical-advance history follows separately.
                </p>
              </div>
              {data.summary.firstVisitOn && data.summary.lastVisitOn ? (
                <Badge className="w-fit gap-1.5 rounded-full" variant="outline">
                  <CalendarDays className="size-3.5" /> {formatDate(data.summary.firstVisitOn)} –{" "}
                  {formatDate(data.summary.lastVisitOn)}
                </Badge>
              ) : null}
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <SummaryCard icon={HeartPulse} label="Visits" value={data.summary.visits} />
              <SummaryCard
                icon={Stethoscope}
                label="Diagnoses & tests"
                value={data.summary.diagnoses}
              />
              <SummaryCard
                icon={UserRoundSearch}
                label="Linked people"
                value={data.summary.linkedPeople}
              />
            </div>

            <Card className="mt-5">
              <CardContent className="p-5">
                <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      aria-label="Search health history"
                      className="pl-9"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search patient, admission number, or diagnosis"
                      value={query}
                    />
                  </div>
                  <Select
                    onValueChange={(value) => setKind(value as NonNullable<HealthFilters["kind"]>)}
                    value={kind}
                  >
                    <SelectTrigger aria-label="Patient type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All patient types</SelectItem>
                      <SelectItem value="child">Children</SelectItem>
                      <SelectItem value="elderly">Elderly</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {error ? (
                  <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <div className="mt-5 space-y-3">
                  {loading ? (
                    <div className="grid min-h-48 place-items-center">
                      <LoaderCircle className="size-5 animate-spin text-primary" />
                    </div>
                  ) : data.visits.length ? (
                    data.visits.map((visit) => (
                      <article className="rounded-2xl border bg-background p-4" key={visit.id}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {visit.personId ? (
                                <button
                                  className="font-semibold underline-offset-4 hover:text-primary hover:underline"
                                  onClick={() => setSelectedPersonId(visit.personId)}
                                  type="button"
                                >
                                  {visit.patientName}
                                </button>
                              ) : (
                                <p className="font-semibold">{visit.patientName}</p>
                              )}
                              <Badge className="rounded-full" variant="secondary">
                                {kindLabel(visit.patientKind)}
                              </Badge>
                              {!visit.personId ? (
                                <Badge className="rounded-full" variant="outline">
                                  Legacy-only identity
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {visit.admissionNumber ? `No. ${visit.admissionNumber} · ` : ""}
                              {visit.homeName ? `${visit.homeName} · ` : ""}
                              {visit.ageAtVisit !== null
                                ? `Age ${visit.ageAtVisit}`
                                : "Age not recorded"}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-medium">
                            {formatDate(visit.checkupDate)}
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {visit.diagnoses.length ? (
                            visit.diagnoses.map((diagnosis) => (
                              <Badge className="rounded-full" key={diagnosis.id} variant="outline">
                                {diagnosis.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              No diagnosis detail recorded
                            </span>
                          )}
                        </div>
                        {visit.doctorName || visit.referredTo || visit.remarks ? (
                          <div className="mt-4 grid gap-1 text-sm text-muted-foreground">
                            {visit.doctorName ? <p>Doctor: {visit.doctorName}</p> : null}
                            {visit.referredTo ? (
                              <p>
                                Referred to: {visit.referredTo}
                                {visit.referralLocation ? ` · ${visit.referralLocation}` : ""}
                              </p>
                            ) : null}
                            {visit.remarks ? <p>{visit.remarks}</p> : null}
                          </div>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">
                      No health visits match these filters.
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    {data.pagination.total.toLocaleString()} matching visits
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((current) => current - 1)}
                      size="icon-sm"
                      variant="outline"
                    >
                      <ChevronLeft />
                    </Button>
                    <span className="min-w-20 text-center text-xs">
                      Page {data.pagination.page} of {Math.max(data.pagination.totalPages, 1)}
                    </span>
                    <Button
                      disabled={page >= data.pagination.totalPages || loading}
                      onClick={() => setPage((current) => current + 1)}
                      size="icon-sm"
                      variant="outline"
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : section === "tb" ? (
          <TbHistory filters={filters} onFiltersChange={onFiltersChange} />
        ) : (
          <MedicalAdvances filters={filters} onFiltersChange={onFiltersChange} />
        )}
      </div>

      <PersonProfileSheet
        onOpenChange={(open) => {
          if (!open) setSelectedPersonId(null);
        }}
        personId={selectedPersonId}
      />
    </main>
  );
}

const emptyTb: TbResponse = {
  summary: {
    cases: 0,
    details: 0,
    linkedPeople: 0,
    onTreatment: 0,
    firstRegistrationOn: null,
    lastRegistrationOn: null,
  },
  outcomes: [],
  cases: [],
  pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
};

function TbHistory({
  filters,
  onFiltersChange,
}: {
  filters: HealthFilters;
  onFiltersChange?: (filters: HealthFilters) => void;
}) {
  const [query, setQuery] = useState(filters.q ?? "");
  const debouncedQuery = useDebouncedValue(query);
  const [kind, setKind] = useState(filters.kind ?? "all");
  const [outcome, setOutcome] = useState(filters.outcome ?? "all");
  const [page, setPage] = useState(filters.page ?? 1);
  const [data, setData] = useState<TbResponse>(emptyTb);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  useEffect(() => {
    setQuery(filters.q ?? "");
    setKind(filters.kind ?? "all");
    setOutcome(filters.outcome ?? "all");
    setPage(filters.page ?? 1);
  }, [filters.kind, filters.outcome, filters.page, filters.q]);

  useEffect(() => {
    onFiltersChange?.({
      section: "tb",
      q: debouncedQuery || undefined,
      kind,
      outcome,
      page,
    });
  }, [debouncedQuery, kind, onFiltersChange, outcome, page]);

  useEffect(() => setPage(1), [debouncedQuery, kind, outcome]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const parameters = new URLSearchParams({
      q: debouncedQuery,
      kind,
      outcome,
      page: String(page),
      pageSize: "25",
    });
    void fetch(`/api/health/tb?${parameters}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as TbResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "TB history could not be loaded.");
        setData(payload);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "TB history could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedQuery, kind, outcome, page]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <ShieldCheck className="size-4" /> Protected by health.read
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">TB register</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Legacy registrations, treatment periods, classifications, outcomes, tests, and results.
          </p>
        </div>
        {data.summary.firstRegistrationOn && data.summary.lastRegistrationOn ? (
          <Badge className="w-fit gap-1.5 rounded-full" variant="outline">
            <CalendarDays className="size-3.5" /> {formatDate(data.summary.firstRegistrationOn)} –{" "}
            {formatDate(data.summary.lastRegistrationOn)}
          </Badge>
        ) : null}
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={HeartPulse} label="TB registrations" value={data.summary.cases} />
        <SummaryCard icon={Stethoscope} label="Tests & follow-ups" value={data.summary.details} />
        <SummaryCard
          icon={UserRoundSearch}
          label="Linked people"
          value={data.summary.linkedPeople}
        />
        <SummaryCard icon={CalendarDays} label="On treatment" value={data.summary.onTreatment} />
      </div>

      <Card className="mt-5">
        <CardContent className="p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_160px_210px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search TB history"
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search patient, admission, TB card, test, or result"
                value={query}
              />
            </div>
            <Select
              onValueChange={(value) => setKind(value as NonNullable<HealthFilters["kind"]>)}
              value={kind}
            >
              <SelectTrigger aria-label="TB patient type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All patient types</SelectItem>
                <SelectItem value="child">Children</SelectItem>
                <SelectItem value="elderly">Elderly</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={setOutcome} value={outcome}>
              <SelectTrigger aria-label="TB outcome">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outcomes</SelectItem>
                {data.outcomes.map((item) => (
                  <SelectItem key={item.name} value={item.name}>
                    {item.name} ({item.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="grid min-h-48 place-items-center">
                <LoaderCircle className="size-5 animate-spin text-primary" />
              </div>
            ) : data.cases.length ? (
              data.cases.map((record) => (
                <article className="rounded-2xl border bg-background p-4" key={record.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {record.personId ? (
                          <button
                            className="font-semibold underline-offset-4 hover:text-primary hover:underline"
                            onClick={() => setSelectedPersonId(record.personId)}
                            type="button"
                          >
                            {record.patientName}
                          </button>
                        ) : (
                          <p className="font-semibold">{record.patientName}</p>
                        )}
                        <Badge className="rounded-full" variant="secondary">
                          {kindLabel(record.patientKind)}
                        </Badge>
                        {record.outcome ? (
                          <Badge className="rounded-full" variant="outline">
                            {record.outcome}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {record.admissionNumber ? `No. ${record.admissionNumber} · ` : ""}
                        {record.tbCardNumber ? `TB card ${record.tbCardNumber} · ` : ""}
                        {record.homeName ? `${record.homeName} · ` : ""}
                        {record.ageAtRegistration !== null
                          ? `Age ${record.ageAtRegistration}`
                          : "Age not recorded"}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium">
                      Registered {formatDate(record.registrationDate)}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <Detail label="Regimen" value={record.treatmentRegimen} />
                    <Detail label="TB type" value={record.tbType} />
                    <Detail label="Case type" value={record.caseType} />
                    <Detail
                      label="Treatment period"
                      value={formatPeriod(record.treatmentStartDate, record.treatmentEndDate)}
                    />
                  </div>

                  {record.details.length ? (
                    <div className="mt-4 overflow-hidden rounded-xl border">
                      {record.details.map((detail) => (
                        <div
                          className="grid gap-1 border-b px-3 py-2.5 text-sm last:border-b-0 sm:grid-cols-[120px_1fr_1fr]"
                          key={detail.id}
                        >
                          <span className="text-muted-foreground">
                            {formatDate(detail.recordedOn)}
                          </span>
                          <span className="font-medium">{detail.testName}</span>
                          <span>{detail.result || detail.remarks || "No result recorded"}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      No treatment detail recorded.
                    </p>
                  )}
                  {record.remarks ? (
                    <p className="mt-3 text-sm text-muted-foreground">{record.remarks}</p>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">
                No TB registrations match these filters.
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between border-t pt-4">
            <p className="text-xs text-muted-foreground">
              {data.pagination.total.toLocaleString()} matching registrations
            </p>
            <div className="flex items-center gap-2">
              <Button
                aria-label="Previous TB page"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
                size="icon-sm"
                variant="outline"
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-20 text-center text-xs">
                Page {data.pagination.page} of {Math.max(data.pagination.totalPages, 1)}
              </span>
              <Button
                aria-label="Next TB page"
                disabled={page >= data.pagination.totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
                size="icon-sm"
                variant="outline"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PersonProfileSheet
        onOpenChange={(open) => {
          if (!open) setSelectedPersonId(null);
        }}
        personId={selectedPersonId}
      />
    </>
  );
}

const emptyMedicalAdvances: MedicalAdvanceResponse = {
  summary: {
    advances: 0,
    advanceAmount: 0,
    patientAllocations: 0,
    settlements: 0,
    settlementLinks: 0,
    totalExpenses: 0,
    firstSanctionOn: null,
    lastSanctionOn: null,
  },
  advances: [],
  pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
};

function MedicalAdvances({
  filters,
  onFiltersChange,
}: {
  filters: HealthFilters;
  onFiltersChange?: (filters: HealthFilters) => void;
}) {
  const [query, setQuery] = useState(filters.q ?? "");
  const debouncedQuery = useDebouncedValue(query);
  const [kind, setKind] = useState(filters.kind ?? "all");
  const [settlement, setSettlement] = useState(filters.settlement ?? "all");
  const [page, setPage] = useState(filters.page ?? 1);
  const [data, setData] = useState<MedicalAdvanceResponse>(emptyMedicalAdvances);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  useEffect(() => {
    setQuery(filters.q ?? "");
    setKind(filters.kind ?? "all");
    setSettlement(filters.settlement ?? "all");
    setPage(filters.page ?? 1);
  }, [filters.kind, filters.page, filters.q, filters.settlement]);

  useEffect(() => {
    onFiltersChange?.({
      section: "advances",
      q: debouncedQuery || undefined,
      kind,
      settlement,
      page,
    });
  }, [debouncedQuery, kind, onFiltersChange, page, settlement]);

  useEffect(() => setPage(1), [debouncedQuery, kind, settlement]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const parameters = new URLSearchParams({
      q: debouncedQuery,
      kind,
      settlement,
      page: String(page),
      pageSize: "25",
    });
    void fetch(`/api/health/advances?${parameters}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as MedicalAdvanceResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Medical advances could not be loaded.");
        setData(payload);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(
          reason instanceof Error ? reason.message : "Medical advances could not be loaded.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedQuery, kind, settlement, page]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <ShieldCheck className="size-4" /> Protected by health.read
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">Medical advances</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Legacy sanctions, patient allocations, referrals, hospital details, and settlements.
          </p>
        </div>
        {data.summary.firstSanctionOn && data.summary.lastSanctionOn ? (
          <Badge className="w-fit gap-1.5 rounded-full" variant="outline">
            <CalendarDays className="size-3.5" /> {formatDate(data.summary.firstSanctionOn)} –{" "}
            {formatDate(data.summary.lastSanctionOn)}
          </Badge>
        ) : null}
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={HeartPulse} label="Sanctions" value={data.summary.advances} />
        <SummaryCard
          icon={Stethoscope}
          label="Amount sanctioned"
          value={formatCurrency(data.summary.advanceAmount)}
        />
        <SummaryCard
          icon={UserRoundSearch}
          label="Patient allocations"
          value={data.summary.patientAllocations}
        />
        <SummaryCard icon={CalendarDays} label="Settlements" value={data.summary.settlements} />
      </div>

      <Card className="mt-5">
        <CardContent className="p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_160px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search medical advances"
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search sanction, patient, diagnosis, or medication"
                value={query}
              />
            </div>
            <Select
              onValueChange={(value) => setKind(value as NonNullable<HealthFilters["kind"]>)}
              value={kind}
            >
              <SelectTrigger aria-label="Advance patient type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All patient types</SelectItem>
                <SelectItem value="child">Children</SelectItem>
                <SelectItem value="elderly">Elderly</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={setSettlement} value={settlement}>
              <SelectTrigger aria-label="Settlement status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All settlements</SelectItem>
                <SelectItem value="settled">Settled</SelectItem>
                <SelectItem value="unsettled">Not settled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="grid min-h-48 place-items-center">
                <LoaderCircle className="size-5 animate-spin text-primary" />
              </div>
            ) : data.advances.length ? (
              data.advances.map((advance) => (
                <article className="rounded-2xl border bg-background p-4" key={advance.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">
                          Sanction {advance.sanctionNumber || "number not recorded"}
                        </p>
                        <Badge className="rounded-full" variant="secondary">
                          {formatCurrency(advance.advanceAmount)}
                        </Badge>
                        <Badge className="rounded-full" variant="outline">
                          {advance.settlements.length ? "Settled" : "Not settled"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {advance.nurseName ? `Nurse: ${advance.nurseName}` : "Nurse not recorded"}
                        {advance.referringDoctorName
                          ? ` · Referred by ${advance.referringDoctorName}`
                          : ""}
                        {advance.referralLocation ? ` · ${advance.referralLocation}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium">
                      {formatDate(advance.sanctionedOn)}
                    </p>
                  </div>

                  <div className="mt-4 space-y-2">
                    {advance.details.map((detail) => (
                      <div className="rounded-xl border p-3" key={detail.id}>
                        <div className="flex flex-wrap items-center gap-2">
                          {detail.personId ? (
                            <button
                              className="font-medium underline-offset-4 hover:text-primary hover:underline"
                              onClick={() => setSelectedPersonId(detail.personId)}
                              type="button"
                            >
                              {detail.patientName}
                            </button>
                          ) : (
                            <p className="font-medium">{detail.patientName}</p>
                          )}
                          <Badge className="rounded-full" variant="outline">
                            {detail.sanctionType}
                          </Badge>
                          <Badge className="rounded-full" variant="secondary">
                            {kindLabel(detail.patientKind)}
                          </Badge>
                          {detail.amount !== null ? (
                            <span className="ml-auto text-sm font-medium">
                              {formatCurrency(detail.amount)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {[
                            detail.diagnosis && `Diagnosis: ${detail.diagnosis}`,
                            detail.medication && `Medication: ${detail.medication}`,
                            detail.referredToDoctorName && `Doctor: ${detail.referredToDoctorName}`,
                            detail.hospitalReferredTo && `Hospital: ${detail.hospitalReferredTo}`,
                            detail.surgeryType && `Surgery: ${detail.surgeryType}`,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "No clinical detail recorded"}
                        </p>
                      </div>
                    ))}
                  </div>

                  {advance.settlements.length ? (
                    <div className="mt-4 rounded-xl bg-muted/60 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        Settlements
                      </p>
                      {advance.settlements.map((value) => (
                        <div
                          className="mt-2 grid gap-1 text-sm sm:grid-cols-[120px_1fr_auto]"
                          key={value.id}
                        >
                          <span>{formatDate(value.settledOn)}</span>
                          <span>
                            {value.billNumber ? `Bill ${value.billNumber}` : "Bill not recorded"}
                          </span>
                          <span className="font-medium">
                            Expenses {formatCurrency(value.totalExpenses ?? 0)} · Balance{" "}
                            {formatCurrency(value.balance ?? 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {advance.remarks ? (
                    <p className="mt-3 text-sm text-muted-foreground">{advance.remarks}</p>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">
                No medical advances match these filters.
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between border-t pt-4">
            <p className="text-xs text-muted-foreground">
              {data.pagination.total.toLocaleString()} matching sanctions
            </p>
            <div className="flex items-center gap-2">
              <Button
                aria-label="Previous medical advance page"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
                size="icon-sm"
                variant="outline"
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-20 text-center text-xs">
                Page {data.pagination.page} of {Math.max(data.pagination.totalPages, 1)}
              </span>
              <Button
                aria-label="Next medical advance page"
                disabled={page >= data.pagination.totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
                size="icon-sm"
                variant="outline"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PersonProfileSheet
        onOpenChange={(open) => {
          if (!open) setSelectedPersonId(null);
        }}
        personId={selectedPersonId}
      />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value || "Not recorded"}</p>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HeartPulse;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold tracking-tight">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function kindLabel(kind: HealthVisit["patientKind"]): string {
  return kind === "child" ? "Child" : kind.charAt(0).toUpperCase() + kind.slice(1);
}

function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return start ? `From ${formatDate(start)}` : `Until ${formatDate(end!)}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}
