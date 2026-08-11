import {
  ArrowLeft,
  BookOpenText,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Home,
  Layers3,
  LoaderCircle,
  MapPin,
  Search,
  ShieldCheck,
  UserPlus,
  UserRoundSearch,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PersonProfileSheet } from "@/components/person-profile-sheet";
import { AdmissionSheet } from "@/components/admission-sheet";
import { HistoricalResults } from "@/components/historical-results";
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

type AcademicSession = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
};

type CountOption = { id?: string; name: string; count: number };

type OverviewResponse = {
  session: AcademicSession;
  canEdit: boolean;
  summary: {
    students: number;
    activeStudents: number;
    inactiveStudents: number;
    schools: number;
    classes: number;
    houses: number;
    unmappedSchools: number;
  };
  filters: {
    schools: CountOption[];
    classes: CountOption[];
    houses: CountOption[];
  };
};

type StudentRow = {
  personId: string;
  displayName: string;
  primaryIdentifier: string;
  status: "active" | "inactive";
  gender: "female" | "male" | "other" | "unknown" | null;
  schoolName: string | null;
  className: string;
  classSection: string | null;
  classTitle: string | null;
  houseName: string | null;
  rollNumber: string | null;
  boardRegistrationNumber: string | null;
  result: string | null;
};

type StudentsResponse = {
  students: StudentRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type SchoolRow = {
  id: string;
  name: string;
  locationName: string | null;
  affiliationNumber: string | null;
  isActive: boolean;
  students: number;
  currentActiveStudents: number;
  classes: number;
  houses: number;
};

type RosterRow = {
  id: string;
  schoolId: string;
  schoolName: string;
  classId: string;
  className: string;
  classLevel: number | null;
  classSection: string | null;
  students: number;
  currentActiveStudents: number;
  femaleStudents: number;
  maleStudents: number;
  houses: number;
};

type SchoolSection = "students" | "schools" | "rosters" | "results";

const emptyStudents: StudentsResponse = {
  students: [],
  pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
};

export function SchoolOperations({
  activeSessionId,
  onBack,
  onSessionChange,
  sessions,
}: {
  activeSessionId: string;
  onBack: () => void;
  onSessionChange: (sessionId: string) => Promise<void>;
  sessions: AcademicSession[];
}) {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [students, setStudents] = useState<StudentsResponse>(emptyStudents);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const [school, setSchool] = useState("all");
  const [className, setClassName] = useState("all");
  const [house, setHouse] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [switchingSession, setSwitchingSession] = useState(false);
  const [error, setError] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [section, setSection] = useState<SchoolSection>("students");
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [rosters, setRosters] = useState<RosterRow[]>([]);
  const [loadingDirectories, setLoadingDirectories] = useState(true);
  const [admissionOpen, setAdmissionOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoadingOverview(true);
    setError("");
    void fetch(
      `/api/school-operations/overview?${new URLSearchParams({ sessionId: activeSessionId })}`,
      { signal: controller.signal },
    )
      .then((response) =>
        parseResponse<OverviewResponse>(response, "The overview could not be loaded."),
      )
      .then(setOverview)
      .catch((reason: unknown) => handleLoadError(reason, controller, setError))
      .finally(() => {
        if (!controller.signal.aborted) setLoadingOverview(false);
      });
    return () => controller.abort();
  }, [activeSessionId, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingDirectories(true);
    const parameters = new URLSearchParams({ sessionId: activeSessionId });
    void Promise.all([
      fetch(`/api/school-operations/schools?${parameters}`, { signal: controller.signal }).then(
        (response) =>
          parseResponse<{ schools: SchoolRow[] }>(
            response,
            "The school directory could not be loaded.",
          ),
      ),
      fetch(`/api/school-operations/rosters?${parameters}`, { signal: controller.signal }).then(
        (response) =>
          parseResponse<{ rosters: RosterRow[] }>(response, "Classes could not be loaded."),
      ),
    ])
      .then(([schoolResponse, rosterResponse]) => {
        setSchools(schoolResponse.schools);
        setRosters(rosterResponse.rosters);
      })
      .catch((reason: unknown) => handleLoadError(reason, controller, setError))
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDirectories(false);
      });
    return () => controller.abort();
  }, [activeSessionId, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({
      sessionId: activeSessionId,
      q: debouncedQuery,
      school,
      class: className,
      house,
      status,
      page: String(page),
      pageSize: "25",
    });
    setLoadingStudents(true);
    setError("");
    void fetch(`/api/school-operations/students?${parameters}`, { signal: controller.signal })
      .then((response) =>
        parseResponse<StudentsResponse>(response, "Students could not be loaded."),
      )
      .then(setStudents)
      .catch((reason: unknown) => handleLoadError(reason, controller, setError))
      .finally(() => {
        if (!controller.signal.aborted) setLoadingStudents(false);
      });
    return () => controller.abort();
  }, [activeSessionId, className, debouncedQuery, house, page, refreshKey, school, status]);

  useEffect(() => setPage(1), [activeSessionId, className, house, school, status]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [activeSessionId, sessions],
  );

  const sectionCopy = {
    students: {
      eyebrow: selectedSession?.name ?? "Academic session",
      title: "Students",
      description: "Students and their classes for this session.",
    },
    schools: {
      eyebrow: `${selectedSession?.name ?? "Session"} directory`,
      title: "Schools",
      description: "Schools, students, classes, and houses.",
    },
    rosters: {
      eyebrow: selectedSession?.name ?? "Academic session",
      title: "Classes",
      description: "Classes and student numbers for this session.",
    },
    results: {
      eyebrow: "Old school records",
      title: "Marks and results",
      description: "Find the marks saved in the old system.",
    },
  }[section];

  async function changeSession(sessionId: string) {
    setSwitchingSession(true);
    setSchool("all");
    setClassName("all");
    setHouse("all");
    setStatus("all");
    setQuery("");
    setPage(1);
    try {
      await onSessionChange(sessionId);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The academic session could not be changed.",
      );
    } finally {
      setSwitchingSession(false);
    }
  }

  return (
    <main className="min-h-svh w-full max-w-none bg-muted/30">
      <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur md:px-6">
        <button className="flex items-center gap-3" onClick={onBack} type="button">
          <div className="grid size-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            TS
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold tracking-tight">Tsewa</div>
            <div className="text-[11px] text-muted-foreground">School</div>
          </div>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <Select
            disabled={switchingSession}
            onValueChange={(value) => void changeSession(value)}
            value={activeSessionId}
          >
            <SelectTrigger aria-label="Academic session" className="w-28 rounded-full sm:w-36">
              {switchingSession ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <CalendarDays className="size-4" />
              )}
              <SelectValue placeholder="Session" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  {session.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge className="hidden gap-1.5 rounded-full lg:inline-flex" variant="outline">
            <ShieldCheck className="size-3.5" /> {overview?.canEdit ? "Can edit" : "View only"}
          </Badge>
          <ThemeToggle />
          <Button
            className="hidden sm:inline-flex"
            onClick={() => void authClient.signOut().then(() => window.location.reload())}
            variant="ghost"
          >
            Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1560px] md:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100svh-4rem)] border-r bg-background/70 p-4 md:block">
          <Button className="mb-5 w-full justify-start" onClick={onBack} variant="ghost">
            <ArrowLeft /> Home
          </Button>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Academics
          </p>
          <nav className="mt-2 space-y-1">
            <SideItem
              active={section === "students"}
              icon={GraduationCap}
              label="Students"
              onClick={() => setSection("students")}
            />
            <SideItem
              active={section === "schools"}
              icon={Building2}
              label="Schools"
              onClick={() => setSection("schools")}
            />
            <SideItem
              active={section === "rosters"}
              icon={Layers3}
              label="Classes"
              onClick={() => setSection("rosters")}
            />
            <SideItem
              active={section === "results"}
              icon={BookOpenText}
              label="Marks and results"
              onClick={() => setSection("results")}
            />
          </nav>
          <div className="mt-7 rounded-2xl border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Session
            </p>
            <p className="mt-2 text-lg font-semibold tracking-tight">
              {selectedSession?.name ?? "—"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              School pages use this session.
            </p>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-7 md:px-7 lg:px-10 lg:py-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Button className="-ml-3 mb-3 md:hidden" onClick={onBack} size="sm" variant="ghost">
                <ArrowLeft /> Home
              </Button>
              <p className="text-sm font-medium text-primary">{sectionCopy.eyebrow}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] md:text-4xl">
                {sectionCopy.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {sectionCopy.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {overview?.canEdit ? (
                <Button onClick={() => setAdmissionOpen(true)}>
                  <UserPlus /> Admit student
                </Button>
              ) : (
                <Badge className="w-fit rounded-full" variant="secondary">
                  View only
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 md:hidden">
            <MobileSectionButton
              active={section === "students"}
              label="Students"
              onClick={() => setSection("students")}
            />
            <MobileSectionButton
              active={section === "schools"}
              label="Schools"
              onClick={() => setSection("schools")}
            />
            <MobileSectionButton
              active={section === "rosters"}
              label="Classes"
              onClick={() => setSection("rosters")}
            />
            <MobileSectionButton
              active={section === "results"}
              label="Results"
              onClick={() => setSection("results")}
            />
          </div>

          {error ? (
            <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
              {message}
            </div>
          ) : null}

          {section === "students" ? (
            <>
              <SummaryCards loading={loadingOverview} overview={overview} />

              <Card className="mt-6 overflow-hidden">
                <CardContent className="p-0">
                  <div className="border-b bg-card p-4">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        aria-label="Search students"
                        className="pl-10"
                        onChange={(event) => {
                          setQuery(event.target.value);
                          setPage(1);
                        }}
                        placeholder="Search student, admission number, or roll number"
                        value={query}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                      <FilterSelect
                        label="All schools"
                        onChange={setSchool}
                        options={overview?.filters.schools ?? []}
                        value={school}
                      />
                      <FilterSelect
                        label="All classes"
                        onChange={setClassName}
                        options={overview?.filters.classes ?? []}
                        value={className}
                      />
                      <FilterSelect
                        label="All houses"
                        onChange={setHouse}
                        options={overview?.filters.houses ?? []}
                        value={house}
                      />
                      <Select
                        onValueChange={(value) => setStatus(value as typeof status)}
                        value={status}
                      >
                        <SelectTrigger aria-label="Current status" className="w-full rounded-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {loadingStudents ? (
                    <div className="grid min-h-72 place-items-center">
                      <div className="text-center">
                        <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />
                        <p className="mt-3 text-sm text-muted-foreground">Loading students…</p>
                      </div>
                    </div>
                  ) : students.students.length ? (
                    <StudentResults
                      data={students}
                      onNext={() => setPage((value) => value + 1)}
                      onPrevious={() => setPage((value) => Math.max(1, value - 1))}
                      onSelect={setSelectedPersonId}
                    />
                  ) : (
                    <div className="grid min-h-72 place-items-center px-6 py-12 text-center">
                      <div className="max-w-sm">
                        <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                          <UserRoundSearch className="size-6" />
                        </div>
                        <h2 className="mt-5 text-lg font-semibold">No students found</h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Try another search, filter, or academic session.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : section === "schools" ? (
            <SchoolsDirectory
              loading={loadingDirectories}
              onOpenRoster={(schoolId) => {
                setSchool(schoolId);
                setClassName("all");
                setPage(1);
                setSection("students");
              }}
              schools={schools}
            />
          ) : section === "rosters" ? (
            <RosterDirectory
              loading={loadingDirectories}
              onOpenRoster={(schoolId, selectedClassId) => {
                setSchool(schoolId);
                setClassName(selectedClassId);
                setPage(1);
                setSection("students");
              }}
              rosters={rosters}
              schools={overview?.filters.schools ?? []}
            />
          ) : (
            <HistoricalResults onSelectPerson={setSelectedPersonId} />
          )}
        </section>
      </div>

      <PersonProfileSheet
        onOpenChange={(open) => {
          if (!open) setSelectedPersonId(null);
        }}
        personId={selectedPersonId}
      />
      <AdmissionSheet
        onCreated={(personId, displayName) => {
          setMessage(`${displayName} was admitted successfully.`);
          setRefreshKey((value) => value + 1);
          setSelectedPersonId(personId);
        }}
        onOpenChange={setAdmissionOpen}
        open={admissionOpen}
        sessionId={activeSessionId}
      />
    </main>
  );
}

function SchoolsDirectory({
  loading,
  onOpenRoster,
  schools,
}: {
  loading: boolean;
  onOpenRoster: (schoolId: string) => void;
  schools: SchoolRow[];
}) {
  if (loading) return <DirectoryLoading label="Loading school directory…" />;
  return (
    <Card className="mt-7 overflow-hidden">
      <CardContent className="p-0">
        <div className="grid gap-3 p-4 md:hidden">
          {schools.map((school) => (
            <button
              className="rounded-2xl border bg-background p-4 text-left transition-colors hover:border-primary/40"
              key={school.id}
              onClick={() => onOpenRoster(school.id)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{school.name}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" /> {school.locationName ?? "Location not recorded"}
                  </p>
                </div>
                <Badge className="rounded-full" variant={school.isActive ? "default" : "secondary"}>
                  {school.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <MiniMetric label="Students" value={school.students} />
                <MiniMetric label="Classes" value={school.classes} />
                <MiniMetric label="Houses" value={school.houses} />
              </div>
            </button>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/45 text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">School</th>
                <th className="px-4 py-3 font-semibold">Affiliation</th>
                <th className="px-4 py-3 font-semibold">Students</th>
                <th className="px-4 py-3 font-semibold">Classes</th>
                <th className="px-4 py-3 font-semibold">Houses</th>
                <th className="px-5 py-3 text-right font-semibold">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {schools.map((school) => (
                <tr className="transition-colors hover:bg-muted/35" key={school.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium">{school.name}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {school.locationName ?? "Not recorded"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {school.affiliationNumber ?? "—"}
                  </td>
                  <td className="px-4 py-4 tabular-nums">
                    {Number(school.students).toLocaleString()}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {Number(school.currentActiveStudents).toLocaleString()} active now
                    </p>
                  </td>
                  <td className="px-4 py-4 tabular-nums">{school.classes}</td>
                  <td className="px-4 py-4 tabular-nums">{school.houses}</td>
                  <td className="px-5 py-4 text-right">
                    <Button onClick={() => onOpenRoster(school.id)} size="sm" variant="ghost">
                      View students
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function RosterDirectory({
  loading,
  onOpenRoster,
  rosters,
  schools,
}: {
  loading: boolean;
  onOpenRoster: (schoolId: string, classId: string) => void;
  rosters: RosterRow[];
  schools: CountOption[];
}) {
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState("all");
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rosters.filter(
      (roster) =>
        (school === "all" || roster.schoolId === school) &&
        (!search ||
          roster.className.toLowerCase().includes(search) ||
          roster.schoolName.toLowerCase().includes(search)),
    );
  }, [query, rosters, school]);

  if (loading) return <DirectoryLoading label="Loading classes…" />;
  return (
    <div className="mt-7">
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_240px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search classes"
              className="pl-10"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search school or class"
              value={query}
            />
          </div>
          <FilterSelect label="All schools" onChange={setSchool} options={schools} value={school} />
        </CardContent>
      </Card>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((roster) => (
          <button
            className="group rounded-2xl border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary/40"
            key={roster.id}
            onClick={() => onOpenRoster(roster.schoolId, roster.classId)}
            type="button"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-primary">{roster.schoolName}</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">{roster.className}</h2>
              </div>
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Layers3 className="size-5" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <MiniMetric label="Students" value={roster.students} />
              <MiniMetric label="Female" value={roster.femaleStudents} />
              <MiniMetric label="Male" value={roster.maleStudents} />
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span>{roster.currentActiveStudents} active</span>
              <span className="font-medium text-primary">View students</span>
            </div>
          </button>
        ))}
      </div>
      {!filtered.length ? (
        <Card className="mt-4">
          <CardContent className="grid min-h-52 place-items-center text-center text-sm text-muted-foreground">
            No classes match these filters.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function DirectoryLoading({ label }: { label: string }) {
  return (
    <Card className="mt-7">
      <CardContent className="grid min-h-64 place-items-center text-center">
        <div>
          <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2 py-2.5">
      <p className="text-base font-semibold tabular-nums">{Number(value).toLocaleString()}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function SummaryCards({
  loading,
  overview,
}: {
  loading: boolean;
  overview: OverviewResponse | null;
}) {
  const cards = [
    {
      icon: Users,
      label: "Students",
      value: overview?.summary.students ?? 0,
      detail: `${(overview?.summary.activeStudents ?? 0).toLocaleString()} active`,
    },
    {
      icon: Building2,
      label: "Schools",
      value: overview?.summary.schools ?? 0,
      detail: overview?.summary.unmappedSchools
        ? `${overview.summary.unmappedSchools} needs review`
        : "All students have a school",
    },
    {
      icon: GraduationCap,
      label: "Classes",
      value: overview?.summary.classes ?? 0,
      detail: "In this session",
    },
    {
      icon: Home,
      label: "Houses",
      value: overview?.summary.houses ?? 0,
      detail: "Used in this session",
    },
  ];
  return (
    <div className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map(({ detail, icon: Icon, label, value }) => (
        <Card key={label}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Icon className="size-4 text-primary" /> {label}
            </div>
            {loading ? (
              <div className="mt-3 h-8 w-16 animate-pulse rounded-lg bg-muted" />
            ) : (
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                {value.toLocaleString()}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StudentResults({
  data,
  onNext,
  onPrevious,
  onSelect,
}: {
  data: StudentsResponse;
  onNext: () => void;
  onPrevious: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <div className="divide-y md:hidden">
        {data.students.map((student) => (
          <button
            className="block w-full px-4 py-4 text-left transition-colors hover:bg-muted/50"
            key={student.personId}
            onClick={() => onSelect(student.personId)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{student.displayName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {student.primaryIdentifier} ·{" "}
                  {student.rollNumber ? `Roll ${student.rollNumber}` : "No roll number"}
                </p>
              </div>
              <RegistryStatusBadge status={student.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <Detail label="School" value={student.schoolName ?? "School not set"} />
              <Detail label="Class" value={student.classTitle ?? student.className} />
              <Detail label="House" value={student.houseName ?? "No house"} />
              <Detail label="Status" value={student.status === "active" ? "Active" : "Inactive"} />
            </div>
          </button>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/45 text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">School</th>
              <th className="px-4 py-3 font-semibold">Class</th>
              <th className="px-4 py-3 font-semibold">House</th>
              <th className="px-4 py-3 font-semibold">Roll</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 text-right font-semibold">Profile</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.students.map((student) => (
              <tr className="transition-colors hover:bg-muted/35" key={student.personId}>
                <td className="px-5 py-3.5">
                  <p className="font-medium">{student.displayName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {student.primaryIdentifier}
                  </p>
                </td>
                <td className="max-w-48 px-4 py-3.5">
                  <p className="truncate">{student.schoolName ?? "School not set"}</p>
                </td>
                <td className="px-4 py-3.5">{student.classTitle ?? student.className}</td>
                <td className="px-4 py-3.5">{student.houseName ?? "No house"}</td>
                <td className="px-4 py-3.5 text-muted-foreground">{student.rollNumber ?? "—"}</td>
                <td className="px-4 py-3.5">
                  <RegistryStatusBadge status={student.status} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Button onClick={() => onSelect(student.personId)} size="sm" variant="ghost">
                    Open profile
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination data={data} onNext={onNext} onPrevious={onPrevious} />
    </>
  );
}

function Pagination({
  data,
  onNext,
  onPrevious,
}: {
  data: StudentsResponse;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs text-muted-foreground">
        {data.pagination.total.toLocaleString()} students · page {data.pagination.page} of{" "}
        {Math.max(data.pagination.totalPages, 1)}
      </p>
      <div className="flex gap-2">
        <Button
          disabled={data.pagination.page <= 1}
          onClick={onPrevious}
          size="sm"
          variant="outline"
        >
          <ChevronLeft /> Previous
        </Button>
        <Button
          disabled={data.pagination.page >= data.pagination.totalPages}
          onClick={onNext}
          size="sm"
          variant="outline"
        >
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: CountOption[];
  value: string;
}) {
  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger aria-label={label} className="w-full rounded-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id ?? option.name} value={option.id ?? option.name}>
            {option.name} · {Number(option.count).toLocaleString()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SideItem({
  active = false,
  icon: Icon,
  label,
  onClick,
  planned = false,
}: {
  active?: boolean;
  icon: typeof GraduationCap;
  label: string;
  onClick?: () => void;
  planned?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"}`}
      disabled={planned}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" />
      <span className="flex-1">{label}</span>
      {planned ? (
        <Badge className="rounded-full px-1.5 text-[10px]" variant="secondary">
          Later
        </Badge>
      ) : null}
    </button>
  );
}

function MobileSectionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      className="shrink-0 rounded-full"
      onClick={onClick}
      size="sm"
      variant={active ? "default" : "outline"}
    >
      {label}
    </Button>
  );
}

function RegistryStatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <Badge className="rounded-full" variant="outline">
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate">{value}</p>
    </div>
  );
}

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;
  const payload = (await response.json()) as { error?: string };
  throw new Error(payload.error ?? fallback);
}

function handleLoadError(
  reason: unknown,
  controller: AbortController,
  setError: (value: string) => void,
) {
  if (controller.signal.aborted || (reason instanceof DOMException && reason.name === "AbortError"))
    return;
  setError(reason instanceof Error ? reason.message : "School pages could not be loaded.");
}
