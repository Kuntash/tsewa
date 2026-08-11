import { GraduationCap, Home, LoaderCircle, Save, Search, Settings2 } from "lucide-react";
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

type AssignmentOption = {
  id: string;
  name: string;
  assigned: boolean;
  isActive: boolean;
  students: number;
};

type AssignmentData = {
  canEdit: boolean;
  school: { id: string; name: string };
  session: { id: string; name: string };
  classes: AssignmentOption[];
  houses: AssignmentOption[];
};

export function SchoolAssignmentsSheet({
  onOpenChange,
  onSaved,
  open,
  school,
  sessionId,
}: {
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
  open: boolean;
  school: { id: string; name: string } | null;
  sessionId: string;
}) {
  const [data, setData] = useState<AssignmentData | null>(null);
  const [classIds, setClassIds] = useState<Set<string>>(new Set());
  const [houseIds, setHouseIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !school) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setQuery("");
    void fetch(
      `/api/school-operations/schools/${school.id}/assignments?${new URLSearchParams({ sessionId })}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const payload = (await response.json()) as AssignmentData & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "School choices could not be loaded.");
        return payload;
      })
      .then((payload) => {
        setData(payload);
        setClassIds(
          new Set(payload.classes.filter((item) => item.assigned).map((item) => item.id)),
        );
        setHouseIds(new Set(payload.houses.filter((item) => item.assigned).map((item) => item.id)));
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : "School choices could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, school, sessionId]);

  const filteredClasses = useMemo(() => filterOptions(data?.classes ?? [], query), [data, query]);
  const filteredHouses = useMemo(() => filterOptions(data?.houses ?? [], query), [data, query]);

  async function save() {
    if (!school) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/school-operations/schools/${school.id}/assignments`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          classIds: [...classIds],
          houseIds: [...houseIds],
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        classes?: number;
        houses?: number;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? "School choices could not be saved.");
      onSaved(
        `${school.name}: ${payload?.classes ?? classIds.size} classes and ${payload?.houses ?? houseIds.size} houses saved.`,
      );
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "School choices could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="sm:max-w-[760px]">
        <SheetTitle className="sr-only">Classes and houses</SheetTitle>
        <SheetDescription className="sr-only">
          Choose the classes and houses used by this school.
        </SheetDescription>
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="border-b bg-[radial-gradient(circle_at_top_left,var(--color-accent),transparent_65%)] px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Settings2 className="size-5" />
            </div>
            <p className="mt-5 text-xs font-semibold text-primary">
              {data?.session.name ?? "Session"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
              {school?.name ?? "School"}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Choose the classes offered in this session and the houses used by this school.
            </p>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
            {error ? (
              <p className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {loading ? (
              <div className="grid min-h-72 place-items-center text-center text-sm text-muted-foreground">
                <div>
                  <LoaderCircle className="mx-auto mb-3 size-5 animate-spin text-primary" />
                  Loading classes and houses…
                </div>
              </div>
            ) : data ? (
              <div className="space-y-7">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Search classes and houses"
                    className="pl-10"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search classes or houses"
                    value={query}
                  />
                </div>

                <AssignmentSection
                  empty="No classes match this search."
                  icon={<GraduationCap className="size-4" />}
                  options={filteredClasses}
                  selectedIds={classIds}
                  setSelectedIds={setClassIds}
                  title="Classes for this session"
                />
                <AssignmentSection
                  empty="No houses match this search."
                  icon={<Home className="size-4" />}
                  options={filteredHouses}
                  selectedIds={houseIds}
                  setSelectedIds={setHouseIds}
                  title="Houses"
                />
              </div>
            ) : null}
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t bg-background/95 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-xs text-muted-foreground">
              Items used by students in this session cannot be removed.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button disabled={saving} onClick={() => onOpenChange(false)} variant="ghost">
                Cancel
              </Button>
              <Button disabled={saving || loading || !data?.canEdit} onClick={() => void save()}>
                {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
                {saving ? "Saving…" : "Save choices"}
              </Button>
            </div>
          </footer>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AssignmentSection({
  empty,
  icon,
  options,
  selectedIds,
  setSelectedIds,
  title,
}: {
  empty: string;
  icon: ReactNode;
  options: AssignmentOption[];
  selectedIds: Set<string>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  title: string;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <span className="text-primary">{icon}</span> {title}
        </h3>
        <Badge className="rounded-full" variant="secondary">
          {selectedIds.size} selected
        </Badge>
      </div>
      {options.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {options.map((option) => {
            const selected = selectedIds.has(option.id);
            const locked = selected && option.students > 0;
            const disabled = locked || (!option.isActive && !selected);
            return (
              <label
                className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                  selected ? "border-primary/40 bg-primary/8" : "bg-card"
                } ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-primary/35"}`}
                key={option.id}
              >
                <input
                  checked={selected}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                  disabled={disabled}
                  onChange={() =>
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (next.has(option.id)) next.delete(option.id);
                      else next.add(option.id);
                      return next;
                    })
                  }
                  type="checkbox"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{option.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {option.students > 0
                      ? `${option.students} student${option.students === 1 ? "" : "s"}`
                      : option.isActive
                        ? "No students"
                        : "Inactive"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
          {empty}
        </p>
      )}
    </section>
  );
}

function filterOptions(options: AssignmentOption[], query: string) {
  const search = query.trim().toLowerCase();
  return search ? options.filter((option) => option.name.toLowerCase().includes(search)) : options;
}
