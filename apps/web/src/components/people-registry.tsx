import {
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  HeartHandshake,
  LoaderCircle,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { PersonProfileSheet } from "@/components/person-profile-sheet";
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

type PersonKind = "child" | "elderly" | "staff";
type PersonStatus = "active" | "inactive";

type PersonRow = {
  id: string;
  kind: PersonKind;
  status: PersonStatus;
  identifierKind: "admission" | "staff";
  primaryIdentifier: string;
  displayName: string;
  gender: "female" | "male" | "other" | "unknown" | null;
  dateOfBirth: string | null;
  admittedOrJoinedOn: string | null;
  campusOrLocation: string | null;
  sourceSystem: string;
  sourceTable: string;
  sourceId: string;
  importedAt: string | null;
};

type RegistryResponse = {
  people: PersonRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: Array<{
    kind: PersonKind;
    status: PersonStatus;
    count: number;
  }>;
  latestImport: null | {
    id: string;
    sourceSystem: string;
    mode: "dry_run" | "import";
    status: "pending" | "running" | "completed" | "failed";
    sourceCount: number;
    eligibleCount: number;
    importedCount: number;
    skippedCount: number;
    issueCount: number;
    createdAt: string;
    finishedAt: string | null;
  };
};

const emptyRegistry: RegistryResponse = {
  people: [],
  pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
  summary: [],
  latestImport: null,
};

export function PeopleRegistry({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const [kind, setKind] = useState<"all" | PersonKind>("all");
  const [status, setStatus] = useState<"all" | PersonStatus>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RegistryResponse>(emptyRegistry);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({
      q: debouncedQuery,
      kind,
      status,
      page: String(page),
      pageSize: "25",
    });

    setLoading(true);
    setError("");
    void fetch(`/api/people?${parameters}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "People could not be loaded.");
        }
        return response.json() as Promise<RegistryResponse>;
      })
      .then(setData)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "People could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, kind, status, page]);

  useEffect(() => setPage(1), [kind, status]);

  const counts = useMemo(() => {
    const next = { all: 0, child: 0, elderly: 0, staff: 0, active: 0, inactive: 0 };
    for (const item of data.summary) {
      next[item.kind] += Number(item.count);
      next[item.status] += Number(item.count);
      next.all += Number(item.count);
    }
    return next;
  }, [data.summary]);

  return (
    <main className="min-h-svh w-full max-w-none bg-muted/30">
      <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background/95 px-4 backdrop-blur md:px-6">
        <button className="flex items-center gap-3" onClick={onBack} type="button">
          <div className="grid size-9 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            TS
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold tracking-tight">Tsewa</div>
            <div className="text-[11px] text-muted-foreground">People</div>
          </div>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <Badge className="hidden gap-1.5 rounded-full sm:inline-flex" variant="outline">
            <ShieldCheck className="size-3.5" /> View only
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

      <div className="mx-auto grid max-w-[1500px] md:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100svh-4rem)] border-r bg-background/70 p-4 md:block">
          <Button className="mb-5 w-full justify-start" onClick={onBack} variant="ghost">
            <ArrowLeft /> Home
          </Button>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Records
          </p>
          <nav className="mt-2 space-y-1">
            <RegistryNavItem
              active={kind === "all"}
              count={counts.all}
              icon={Search}
              label="All people"
              onClick={() => setKind("all")}
            />
            <RegistryNavItem
              active={kind === "child"}
              count={counts.child}
              icon={UserRound}
              label="Children"
              onClick={() => setKind("child")}
            />
            <RegistryNavItem
              active={kind === "elderly"}
              count={counts.elderly}
              icon={HeartHandshake}
              label="Elderly"
              onClick={() => setKind("elderly")}
            />
            <RegistryNavItem
              active={kind === "staff"}
              count={counts.staff}
              icon={BriefcaseBusiness}
              label="Staff"
              onClick={() => setKind("staff")}
            />
          </nav>
        </aside>

        <section className="min-w-0 px-4 py-7 md:px-7 lg:px-10 lg:py-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Button className="-ml-3 mb-3 md:hidden" onClick={onBack} size="sm" variant="ghost">
                <ArrowLeft /> Home
              </Button>
              <p className="text-sm font-medium text-primary">People</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">Find a person</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Search children, elderly residents, and staff.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="rounded-full" variant="secondary">
                {counts.active.toLocaleString()} active
              </Badge>
              <Badge className="rounded-full" variant="outline">
                {counts.inactive.toLocaleString()} inactive
              </Badge>
            </div>
          </div>

          <Card className="mt-7 overflow-hidden">
            <CardContent className="p-0">
              <div className="grid gap-3 border-b bg-card p-4 md:grid-cols-[minmax(260px,1fr)_160px_160px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search people"
                    className="pl-10"
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search name, admission or staff number"
                    value={query}
                  />
                </div>
                <Select onValueChange={(value) => setKind(value as typeof kind)} value={kind}>
                  <SelectTrigger className="w-full rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All people</SelectItem>
                    <SelectItem value="child">Children</SelectItem>
                    <SelectItem value="elderly">Elderly</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
                <Select onValueChange={(value) => setStatus(value as typeof status)} value={status}>
                  <SelectTrigger className="w-full rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error ? (
                <div className="m-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              ) : loading ? (
                <div className="grid min-h-72 place-items-center">
                  <div className="text-center">
                    <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />
                    <p className="mt-3 text-sm text-muted-foreground">Loading people…</p>
                  </div>
                </div>
              ) : data.people.length ? (
                <PeopleResults
                  data={data}
                  onNext={() => {
                    setPage((current) => current + 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onPrevious={() => {
                    setPage((current) => Math.max(1, current - 1));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onSelectPerson={setSelectedPersonId}
                />
              ) : (
                <div className="grid min-h-80 place-items-center px-6 py-12 text-center">
                  <div className="max-w-md">
                    <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                      <Users className="size-6" />
                    </div>
                    <h2 className="mt-5 text-lg font-semibold">
                      {query || kind !== "all" || status !== "all"
                        ? "No matching people"
                        : "No people have been added yet"}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {query || kind !== "all" || status !== "all"
                        ? "Try a different search or clear one of the filters."
                        : "Import people before using this page."}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
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

function RegistryNavItem({
  active,
  count,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  icon: typeof Search;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" />
      <span className="flex-1">{label}</span>
      <span className="text-xs tabular-nums">{count.toLocaleString()}</span>
    </button>
  );
}

function PeopleResults({
  data,
  onNext,
  onPrevious,
  onSelectPerson,
}: {
  data: RegistryResponse;
  onNext: () => void;
  onPrevious: () => void;
  onSelectPerson: (personId: string) => void;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/35 text-left text-xs text-muted-foreground">
              <th className="px-5 py-3 font-medium">Identifier</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Gender</th>
              <th className="px-5 py-3 font-medium">Date of birth</th>
              <th className="px-5 py-3 font-medium">Campus / location</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="w-12 px-3 py-3 font-medium">
                <span className="sr-only">Open profile</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.people.map((person) => (
              <tr className="border-b last:border-b-0 hover:bg-muted/25" key={person.id}>
                <td className="px-5 py-4 font-mono text-xs text-muted-foreground">
                  {person.primaryIdentifier}
                </td>
                <td className="px-5 py-4 font-semibold">
                  <button
                    className="text-left underline-offset-4 hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onSelectPerson(person.id)}
                    type="button"
                  >
                    {person.displayName}
                  </button>
                </td>
                <td className="px-5 py-4">
                  <KindBadge kind={person.kind} />
                </td>
                <td className="px-5 py-4 capitalize text-muted-foreground">
                  {person.gender ?? "—"}
                </td>
                <td className="px-5 py-4 text-muted-foreground">
                  {formatDate(person.dateOfBirth)}
                </td>
                <td className="px-5 py-4 text-muted-foreground">
                  {person.campusOrLocation || "—"}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={person.status} />
                </td>
                <td className="px-3 py-4">
                  <Button
                    aria-label={`Open profile for ${person.displayName}`}
                    onClick={() => onSelectPerson(person.id)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <ArrowUpRight />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y md:hidden">
        {data.people.map((person) => (
          <button
            className="w-full p-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            key={person.id}
            onClick={() => onSelectPerson(person.id)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{person.displayName}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {person.primaryIdentifier}
                </p>
              </div>
              <StatusBadge status={person.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <KindBadge kind={person.kind} />
              <span className="capitalize">{person.gender ?? "Unknown gender"}</span>
              <span>·</span>
              <span>{formatDate(person.dateOfBirth)}</span>
              {person.campusOrLocation ? <span>· {person.campusOrLocation}</span> : null}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          {data.pagination.total.toLocaleString()} people · page {data.pagination.page} of{" "}
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
    </>
  );
}

function KindBadge({ kind }: { kind: PersonKind }) {
  return (
    <Badge className="rounded-full capitalize" variant="outline">
      {kind}
    </Badge>
  );
}

function StatusBadge({ status }: { status: PersonStatus }) {
  return (
    <Badge className="rounded-full" variant={status === "active" ? "default" : "secondary"}>
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
