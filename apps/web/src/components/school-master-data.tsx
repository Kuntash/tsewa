import { GraduationCap, Home, LoaderCircle, Pencil, Plus, Save } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

type AcademicClass = {
  id: string;
  name: string;
  baseName: string;
  section: string | null;
  level: number | null;
  sortOrder: number | null;
  isActive: boolean;
};

type House = { id: string; name: string; isActive: boolean };

type MasterData = {
  canEdit: boolean;
  classes: AcademicClass[];
  houses: House[];
};

type Editor =
  | { kind: "class"; value: AcademicClass | null }
  | { kind: "house"; value: House | null }
  | null;

export function SchoolMasterData({
  onChanged,
  sessionId,
}: {
  onChanged: (message: string) => void;
  sessionId: string;
}) {
  const [data, setData] = useState<MasterData | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(`/api/school-operations/master-data?${new URLSearchParams({ sessionId })}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as MasterData & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "School setup could not be loaded.");
        setData(payload);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "School setup could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey, sessionId]);

  function saved(message: string) {
    setEditor(null);
    setRefreshKey((value) => value + 1);
    onChanged(message);
  }

  if (loading) {
    return (
      <Card className="mt-7">
        <CardContent className="grid min-h-64 place-items-center text-center">
          <div>
            <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Loading classes and houses…</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <p className="mt-7 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error || "School setup could not be loaded."}
      </p>
    );
  }

  return (
    <>
      <div className="mt-7 grid gap-5 xl:grid-cols-2">
        <MasterList
          action={
            data.canEdit ? (
              <Button onClick={() => setEditor({ kind: "class", value: null })} size="sm">
                <Plus /> Add class
              </Button>
            ) : null
          }
          description="One entry for each class and section used by the schools."
          icon={<GraduationCap className="size-5" />}
          title="Classes and sections"
        >
          {data.classes.length ? (
            <div className="divide-y">
              {data.classes.map((academicClass) => (
                <MasterRow
                  active={academicClass.isActive}
                  key={academicClass.id}
                  name={academicClass.name}
                  onEdit={
                    data.canEdit
                      ? () => setEditor({ kind: "class", value: academicClass })
                      : undefined
                  }
                  secondary={
                    academicClass.level === null
                      ? "Level not set"
                      : `Level ${academicClass.level}${academicClass.sortOrder === null ? "" : ` · Order ${academicClass.sortOrder}`}`
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyRecord label="No classes have been added." />
          )}
        </MasterList>

        <MasterList
          action={
            data.canEdit ? (
              <Button onClick={() => setEditor({ kind: "house", value: null })} size="sm">
                <Plus /> Add house
              </Button>
            ) : null
          }
          description="Houses available when admitting or moving a student."
          icon={<Home className="size-5" />}
          title="Houses"
        >
          {data.houses.length ? (
            <div className="divide-y">
              {data.houses.map((house) => (
                <MasterRow
                  active={house.isActive}
                  key={house.id}
                  name={house.name}
                  onEdit={
                    data.canEdit ? () => setEditor({ kind: "house", value: house }) : undefined
                  }
                  secondary={
                    house.isActive
                      ? "Available for student records"
                      : "Not available for new records"
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyRecord label="No houses have been added." />
          )}
        </MasterList>
      </div>

      <MasterDataEditor
        editor={editor}
        onOpenChange={(open) => !open && setEditor(null)}
        onSaved={saved}
      />
    </>
  );
}

function MasterList({
  action,
  children,
  description,
  icon,
  title,
}: {
  action: ReactNode;
  children: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-3 border-b p-4 sm:p-5">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          </div>
          {action}
        </div>
        <div className="max-h-[560px] overflow-y-auto">{children}</div>
      </CardContent>
    </Card>
  );
}

function MasterRow({
  active,
  name,
  onEdit,
  secondary,
}: {
  active: boolean;
  name: string;
  onEdit?: () => void;
  secondary: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{name}</p>
          <Badge className="rounded-full" variant={active ? "default" : "secondary"}>
            {active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{secondary}</p>
      </div>
      {onEdit ? (
        <Button onClick={onEdit} size="sm" variant="outline">
          <Pencil /> Edit
        </Button>
      ) : null}
    </div>
  );
}

function EmptyRecord({ label }: { label: string }) {
  return <p className="p-5 text-sm text-muted-foreground">{label}</p>;
}

function MasterDataEditor({
  editor,
  onOpenChange,
  onSaved,
}: {
  editor: Editor;
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
}) {
  const isClass = editor?.kind === "class";
  const value = editor?.value;
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [level, setLevel] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editor) return;
    setName(
      isClass
        ? ((value as AcademicClass | null)?.baseName ?? "")
        : ((value as House | null)?.name ?? ""),
    );
    setSection(isClass ? ((value as AcademicClass | null)?.section ?? "") : "");
    setLevel(
      isClass &&
        (value as AcademicClass | null)?.level !== null &&
        (value as AcademicClass | null)?.level !== undefined
        ? String((value as AcademicClass).level)
        : "",
    );
    setSortOrder(
      isClass &&
        (value as AcademicClass | null)?.sortOrder !== null &&
        (value as AcademicClass | null)?.sortOrder !== undefined
        ? String((value as AcademicClass).sortOrder)
        : "",
    );
    setIsActive(value?.isActive ?? true);
    setError("");
  }, [editor, isClass, value]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setError("");
    const endpoint = `/api/school-operations/${isClass ? "classes" : "houses"}${value ? `/${value.id}` : ""}`;
    try {
      const response = await fetch(endpoint, {
        method: value ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          isClass
            ? {
                name,
                section: section.trim() || null,
                level: level === "" ? null : Number(level),
                sortOrder: sortOrder === "" ? null : Number(sortOrder),
                isActive,
              }
            : { name, isActive },
        ),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "The record could not be saved.");
      const label = isClass ? "Class" : "House";
      onSaved(`${label} ${value ? "updated" : "added"}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The record could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const label = isClass ? "class" : "house";
  return (
    <Sheet onOpenChange={onOpenChange} open={Boolean(editor)}>
      <SheetContent>
        <SheetTitle className="sr-only">{value ? `Edit ${label}` : `Add ${label}`}</SheetTitle>
        <SheetDescription className="sr-only">Add or update this {label}.</SheetDescription>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={save}>
          <header className="border-b bg-[radial-gradient(circle_at_top_left,var(--color-accent),transparent_65%)] px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              School setup
            </p>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
              {value ? `Edit ${label}` : `Add ${label}`}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {isClass
                ? "Use a simple class name and section, such as I and A."
                : "Use the house name staff already know."}
            </p>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
            {error ? (
              <p className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="space-y-5">
              <Field htmlFor="master-name" label={isClass ? "Class name" : "House name"} required>
                <Input
                  autoFocus
                  id="master-name"
                  maxLength={100}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </Field>
              {isClass ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field htmlFor="master-section" label="Section">
                    <Input
                      id="master-section"
                      maxLength={30}
                      onChange={(event) => setSection(event.target.value)}
                      placeholder="A"
                      value={section}
                    />
                  </Field>
                  <Field htmlFor="master-level" label="Level">
                    <Input
                      id="master-level"
                      max={30}
                      min={0}
                      onChange={(event) => setLevel(event.target.value)}
                      placeholder="1"
                      type="number"
                      value={level}
                    />
                  </Field>
                  <Field htmlFor="master-order" label="Display order">
                    <Input
                      id="master-order"
                      max={1000}
                      min={0}
                      onChange={(event) => setSortOrder(event.target.value)}
                      type="number"
                      value={sortOrder}
                    />
                  </Field>
                </div>
              ) : null}
              <label className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3">
                <input
                  checked={isActive}
                  className="mt-0.5 size-4 accent-primary"
                  onChange={(event) => setIsActive(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <span className="block text-sm font-medium">Active {label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Active records are available for new admissions and student changes.
                  </span>
                </span>
              </label>
            </div>
          </div>
          <footer className="flex flex-col-reverse gap-2 border-t bg-background/95 px-5 py-4 sm:flex-row sm:justify-end sm:px-8">
            <Button
              disabled={saving}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
              {saving ? "Saving…" : `Save ${label}`}
            </Button>
          </footer>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  children,
  htmlFor,
  label,
  required = false,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label className="mb-2" htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}
