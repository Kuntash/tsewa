import {
  BookCopy,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type Catalog = { id: string; name: string; sourceSystem: string };
type Grade = {
  id: string;
  gradeTypeId: string;
  name: string;
  startsAt: number;
  endsAt: number;
  points: number;
  sourceSystem: string;
};
type Subject = Catalog & {
  shortName: string | null;
  subjectTypeId: string | null;
  subjectHeadId: string | null;
  gradeTypeId: string | null;
  isOptional: boolean;
  passingPercentage: number | null;
  isActive: boolean;
};
type Mapping = {
  id: string;
  academicClassId: string;
  subjectId: string;
  maximumMarks: number | null;
  displayOrder: number | null;
  sourceSystem: string;
};
type Limit = {
  id: string;
  academicClassId: string;
  subjectId: string;
  assessmentId: string;
  maximumMarks: number | null;
};
type Data = {
  session: { id: string; name: string };
  subjectTypes: Catalog[];
  subjectHeads: Catalog[];
  gradeTypes: Catalog[];
  grades: Grade[];
  subjects: Subject[];
  classes: Array<{ id: string; name: string }>;
  assessments: Array<{ id: string; termId: string; name: string }>;
  mappings: Mapping[];
  assessmentLimits: Limit[];
  capabilities: { manage: boolean };
};

export function AcademicConfiguration({
  open,
  onOpenChange,
  sessionId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  sessionId: string;
  onChanged: (message: string) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [view, setView] = useState<"catalogs" | "curriculum">("catalogs");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState<Subject | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/school-operations/academic-configuration?${new URLSearchParams({ sessionId })}`,
      );
      const body = (await response.json()) as Data & { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "Academic configuration could not be loaded.");
      setData(body);
      setClassId((current) => current || body.classes[0]?.id || "");
    } catch (reason) {
      setError(message(reason));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (open) void load();
  }, [open, sessionId]);

  async function mutate(payload: Record<string, unknown>, key: string, success: string) {
    setSaving(key);
    setError("");
    try {
      const response = await fetch("/api/school-operations/academic-configuration", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, ...payload }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Academic configuration could not be saved.");
      await load();
      onChanged(success);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setSaving("");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-5xl">
        <div className="sticky top-0 z-10 border-b bg-background/95 px-5 py-5 backdrop-blur md:px-8">
          <div className="flex items-start justify-between gap-5 pr-10">
            <div>
              <SheetTitle className="text-2xl tracking-tight">Academic configuration</SheetTitle>
              <SheetDescription className="mt-1">
                Curriculum structure for {data?.session.name ?? "the selected session"}
              </SheetDescription>
            </div>
            {data && !data.capabilities.manage ? (
              <Badge variant="secondary">View only</Badge>
            ) : null}
          </div>
          <div className="mt-5 flex gap-1 rounded-xl bg-muted p-1">
            <ViewButton
              active={view === "catalogs"}
              icon={BookCopy}
              label="Catalogs & grades"
              onClick={() => setView("catalogs")}
            />
            <ViewButton
              active={view === "curriculum"}
              icon={Settings2}
              label="Class curriculum"
              onClick={() => setView("curriculum")}
            />
          </div>
        </div>
        <div className="px-5 py-6 md:px-8">
          {error ? (
            <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {loading && !data ? (
            <div className="grid min-h-80 place-items-center">
              <LoaderCircle className="size-6 animate-spin text-primary" />
            </div>
          ) : data && view === "catalogs" ? (
            <CatalogWorkspace
              data={data}
              disabled={!data.capabilities.manage || Boolean(saving)}
              onDelete={(kind, id, name) => {
                if (!window.confirm(`Remove ${name}? This is allowed only when it is not in use.`))
                  return;
                void mutate({ action: "delete", kind, id }, `delete:${id}`, `${name} removed.`);
              }}
              onMutate={mutate}
              onSubject={setSubject}
              subject={subject}
            />
          ) : data ? (
            <CurriculumWorkspace
              classId={classId}
              data={data}
              disabled={!data.capabilities.manage || Boolean(saving)}
              onClass={setClassId}
              onMutate={mutate}
              saving={saving}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CatalogWorkspace({
  data,
  disabled,
  onDelete,
  onMutate,
  onSubject,
  subject,
}: {
  data: Data;
  disabled: boolean;
  onDelete: (kind: string, id: string, name: string) => void;
  onMutate: (payload: Record<string, unknown>, key: string, success: string) => Promise<void>;
  onSubject: (subject: Subject | null) => void;
  subject: Subject | null;
}) {
  const [gradeBeingEdited, setGradeBeingEdited] = useState<Grade | null>(null);
  return (
    <div className="space-y-7">
      <div className="grid gap-4 md:grid-cols-3">
        <CatalogCard
          title="Subject types"
          note="Scholastic grouping"
          kind="subjectType"
          rows={data.subjectTypes}
          disabled={disabled}
          onDelete={onDelete}
          onMutate={onMutate}
        />
        <CatalogCard
          title="Subject heads"
          note="Legacy subject families"
          kind="subjectHead"
          rows={data.subjectHeads}
          disabled={disabled}
          onDelete={onDelete}
          onMutate={onMutate}
        />
        <CatalogCard
          title="Grade types"
          note="Reusable grading scales"
          kind="gradeType"
          rows={data.gradeTypes}
          disabled={disabled}
          onDelete={onDelete}
          onMutate={onMutate}
        />
      </div>
      <section>
        <SectionHeading title="Grade bands" count={data.grades.length} />
        <GradeForm
          data={data}
          disabled={disabled}
          grade={gradeBeingEdited}
          onCancel={() => setGradeBeingEdited(null)}
          onMutate={onMutate}
        />
        <div className="mt-3 divide-y rounded-xl border bg-card">
          {data.grades.map((grade) => (
            <div
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 text-sm"
              key={grade.id}
            >
              <div>
                <span className="font-medium">{grade.name}</span>
                <span className="ml-2 text-muted-foreground">
                  {data.gradeTypes.find((x) => x.id === grade.gradeTypeId)?.name}
                </span>
              </div>
              <span className="tabular-nums text-muted-foreground">
                {grade.startsAt}–{grade.endsAt} · {grade.points} pts
              </span>
              <div className="flex gap-1">
                <Button
                  aria-label="Edit grade"
                  disabled={disabled}
                  onClick={() => setGradeBeingEdited(grade)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <DeleteButton
                  disabled={disabled}
                  onClick={() => onDelete("grade", grade.id, grade.name)}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="flex items-end justify-between">
          <SectionHeading title="Subjects" count={data.subjects.length} />
          <Button disabled={disabled} onClick={() => onSubject(blankSubject())} size="sm">
            <Plus /> Add subject
          </Button>
        </div>
        {subject ? (
          <SubjectForm
            data={data}
            disabled={disabled}
            onCancel={() => onSubject(null)}
            onMutate={onMutate}
            subject={subject}
          />
        ) : null}
        <div className="mt-3 divide-y rounded-xl border bg-card">
          {data.subjects.map((item) => (
            <button
              className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              key={item.id}
              onClick={() => onSubject(item)}
              type="button"
            >
              <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <GraduationCap className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {item.name}{" "}
                  {item.shortName ? (
                    <span className="font-normal text-muted-foreground">· {item.shortName}</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {data.subjectTypes.find((x) => x.id === item.subjectTypeId)?.name ?? "No type"} ·{" "}
                  {data.subjectHeads.find((x) => x.id === item.subjectHeadId)?.name ?? "No head"}
                </p>
              </div>
              <Badge variant={item.isActive ? "secondary" : "outline"}>
                {item.isActive ? "Active" : "Inactive"}
              </Badge>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function CatalogCard({
  title,
  note,
  kind,
  rows,
  disabled,
  onDelete,
  onMutate,
}: {
  title: string;
  note: string;
  kind: string;
  rows: Catalog[];
  disabled: boolean;
  onDelete: (kind: string, id: string, name: string) => void;
  onMutate: AcademicConfigurationProps["onMutate"];
}) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState("");
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          void onMutate(
            { action: "saveCatalog", kind, id: editingId || undefined, name },
            editingId ? `catalog:${editingId}` : `new:${kind}`,
            `${name.trim()} saved.`,
          ).then(() => {
            setName("");
            setEditingId("");
          });
        }}
      >
        <Input
          disabled={disabled}
          onChange={(event) => setName(event.target.value)}
          placeholder="Add name"
          value={name}
        />
        {editingId ? (
          <Button
            aria-label="Cancel editing"
            disabled={disabled}
            onClick={() => {
              setEditingId("");
              setName("");
            }}
            size="icon"
            type="button"
            variant="outline"
          >
            <X />
          </Button>
        ) : null}
        <Button
          aria-label={editingId ? `Save ${title}` : `Add ${title}`}
          disabled={disabled}
          size="icon"
          type="submit"
        >
          {editingId ? <Save /> : <Plus />}
        </Button>
      </form>
      <div className="mt-3 space-y-1">
        {rows.map((row) => (
          <div
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
            key={row.id}
          >
            <button
              className="min-w-0 flex-1 truncate text-left"
              disabled={disabled}
              onClick={() => {
                setEditingId(row.id);
                setName(row.name);
              }}
              type="button"
            >
              {row.name}
            </button>
            <DeleteButton disabled={disabled} onClick={() => onDelete(kind, row.id, row.name)} />
          </div>
        ))}
      </div>
    </div>
  );
}

type AcademicConfigurationProps = {
  onMutate: (payload: Record<string, unknown>, key: string, success: string) => Promise<void>;
};

function GradeForm({
  data,
  disabled,
  grade,
  onCancel,
  onMutate,
}: {
  data: Data;
  disabled: boolean;
  grade: Grade | null;
  onCancel: () => void;
} & AcademicConfigurationProps) {
  return (
    <form
      key={grade?.id ?? "new-grade"}
      className="mt-3 grid gap-2 rounded-xl border bg-muted/30 p-3 sm:grid-cols-[1.4fr_.7fr_.7fr_.7fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);
        void onMutate(
          {
            action: "saveGrade",
            id: grade?.id,
            gradeTypeId: form.get("gradeTypeId"),
            name: form.get("name"),
            startsAt: Number(form.get("startsAt")),
            endsAt: Number(form.get("endsAt")),
            points: Number(form.get("points")),
          },
          grade ? `grade:${grade.id}` : "new:grade",
          "Grade band saved.",
        ).then(() => {
          element.reset();
          onCancel();
        });
      }}
    >
      <select
        className="h-9 rounded-md border bg-background px-3 text-sm"
        defaultValue={grade?.gradeTypeId ?? ""}
        disabled={disabled}
        name="gradeTypeId"
        required
      >
        <option value="">Grade type</option>
        {data.gradeTypes.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
      <Input
        defaultValue={grade?.name ?? ""}
        disabled={disabled}
        name="name"
        placeholder="Grade"
        required
      />
      <Input
        defaultValue={grade?.startsAt ?? ""}
        disabled={disabled}
        name="startsAt"
        placeholder="From"
        required
        step="0.01"
        type="number"
      />
      <Input
        defaultValue={grade?.endsAt ?? ""}
        disabled={disabled}
        name="endsAt"
        placeholder="To"
        required
        step="0.01"
        type="number"
      />
      <div className="flex gap-2">
        <Input
          className="w-20"
          defaultValue={grade?.points ?? ""}
          disabled={disabled}
          name="points"
          placeholder="Points"
          required
          step="0.01"
          type="number"
        />
        {grade ? (
          <Button
            aria-label="Cancel editing"
            disabled={disabled}
            onClick={onCancel}
            size="icon"
            type="button"
            variant="outline"
          >
            <X />
          </Button>
        ) : null}
        <Button disabled={disabled} size="icon" type="submit">
          {grade ? <Save /> : <Plus />}
        </Button>
      </div>
    </form>
  );
}

function SubjectForm({
  data,
  disabled,
  onCancel,
  onMutate,
  subject,
}: {
  data: Data;
  disabled: boolean;
  onCancel: () => void;
  subject: Subject;
} & AcademicConfigurationProps) {
  return (
    <form
      className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-4"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const f = new FormData(event.currentTarget);
        void onMutate(
          {
            action: "saveSubject",
            id: subject.id || undefined,
            name: f.get("name"),
            shortName: f.get("shortName") || null,
            subjectTypeId: nullable(f.get("subjectTypeId")),
            subjectHeadId: nullable(f.get("subjectHeadId")),
            gradeTypeId: nullable(f.get("gradeTypeId")),
            passingPercentage: f.get("passingPercentage")
              ? Number(f.get("passingPercentage"))
              : null,
            isOptional: f.get("isOptional") === "on",
            isActive: f.get("isActive") === "on",
          },
          `subject:${subject.id}`,
          `${formText(f, "name") || "Subject"} saved.`,
        ).then(onCancel);
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Subject name">
          <Input defaultValue={subject.name} disabled={disabled} name="name" required />
        </Field>
        <Field label="Short name">
          <Input defaultValue={subject.shortName ?? ""} disabled={disabled} name="shortName" />
        </Field>
        <NativeSelect
          defaultValue={subject.subjectTypeId ?? ""}
          disabled={disabled}
          label="Subject type"
          name="subjectTypeId"
          rows={data.subjectTypes}
        />
        <NativeSelect
          defaultValue={subject.subjectHeadId ?? ""}
          disabled={disabled}
          label="Subject head"
          name="subjectHeadId"
          rows={data.subjectHeads}
        />
        <NativeSelect
          defaultValue={subject.gradeTypeId ?? ""}
          disabled={disabled}
          label="Grade type"
          name="gradeTypeId"
          rows={data.gradeTypes}
        />
        <Field label="Passing percentage">
          <Input
            defaultValue={subject.passingPercentage ?? ""}
            disabled={disabled}
            max="100"
            min="0"
            name="passingPercentage"
            type="number"
          />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input
            defaultChecked={subject.isOptional}
            disabled={disabled}
            name="isOptional"
            type="checkbox"
          />{" "}
          Optional
        </label>
        <label className="flex items-center gap-2">
          <input
            defaultChecked={subject.isActive}
            disabled={disabled}
            name="isActive"
            type="checkbox"
          />{" "}
          Active
        </label>
        <div className="ml-auto flex gap-2">
          {subject.id ? (
            <Button
              disabled={disabled}
              onClick={() => {
                if (
                  !window.confirm(
                    `Remove ${subject.name}? This is allowed only when it is not in use.`,
                  )
                )
                  return;
                void onMutate(
                  { action: "delete", kind: "subject", id: subject.id },
                  `delete:${subject.id}`,
                  `${subject.name} removed.`,
                ).then(onCancel);
              }}
              type="button"
              variant="destructive"
            >
              <Trash2 /> Delete
            </Button>
          ) : null}
          <Button onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={disabled} type="submit">
            <Save /> Save subject
          </Button>
        </div>
      </div>
    </form>
  );
}

function CurriculumWorkspace({
  classId,
  data,
  disabled,
  onClass,
  onMutate,
  saving,
}: {
  classId: string;
  data: Data;
  disabled: boolean;
  onClass: (id: string) => void;
  saving: string;
} & AcademicConfigurationProps) {
  const rows = useMemo(() => data.subjects.filter((x) => x.isActive), [data.subjects]);
  return (
    <div>
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Label>Class</Label>
          <Select onValueChange={onClass} value={classId}>
            <SelectTrigger className="mt-2 w-72 max-w-full">
              <SelectValue placeholder="Choose class" />
            </SelectTrigger>
            <SelectContent>
              {data.classes.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="max-w-lg text-xs leading-5 text-muted-foreground">
          Assign subjects in report-card order. Assessment limits become the enforced maximum marks
          in mark entry.
        </p>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((item) => (
          <CurriculumRow
            classId={classId}
            data={data}
            disabled={disabled}
            key={`${classId}:${item.id}`}
            onMutate={onMutate}
            saving={saving}
            subject={item}
          />
        ))}
      </div>
    </div>
  );
}

function CurriculumRow({
  classId,
  data,
  disabled,
  onMutate,
  saving,
  subject,
}: {
  classId: string;
  data: Data;
  disabled: boolean;
  saving: string;
  subject: Subject;
} & AcademicConfigurationProps) {
  const mapping = data.mappings.find(
    (x) => x.academicClassId === classId && x.subjectId === subject.id,
  );
  const limits = data.assessmentLimits.filter(
    (x) => x.academicClassId === classId && x.subjectId === subject.id,
  );
  const [enabled, setEnabled] = useState(Boolean(mapping));
  useEffect(() => setEnabled(Boolean(mapping)), [mapping?.id]);
  return (
    <form
      className={`rounded-xl border p-4 ${enabled ? "bg-card" : "bg-muted/20 opacity-75"}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (mapping && !enabled && !window.confirm(`Remove ${subject.name} from this class?`))
          return;
        const f = new FormData(event.currentTarget);
        void onMutate(
          {
            action: "saveClassSubject",
            academicClassId: classId,
            subjectId: subject.id,
            enabled,
            maximumMarks: Number(f.get("maximumMarks") || 100),
            displayOrder: Number(f.get("displayOrder") || 0),
            assessmentLimits: enabled
              ? data.assessments.map((x) => ({
                  assessmentId: x.id,
                  maximumMarks: Number(f.get(`assessment:${x.id}`) || f.get("maximumMarks") || 100),
                }))
              : [],
          },
          `mapping:${subject.id}`,
          `${subject.name} curriculum saved.`,
        );
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-w-52 flex-1 items-center gap-3 font-medium">
          <input
            checked={enabled}
            disabled={disabled}
            onChange={(event) => setEnabled(event.target.checked)}
            type="checkbox"
          />
          {subject.name}
        </label>
        <Input
          className="w-24"
          defaultValue={mapping?.displayOrder ?? 0}
          disabled={disabled || !enabled}
          min="0"
          name="displayOrder"
          title="Display order"
          type="number"
        />
        <Input
          className="w-28"
          defaultValue={mapping?.maximumMarks ?? 100}
          disabled={disabled || !enabled}
          min="1"
          name="maximumMarks"
          title="Subject maximum"
          type="number"
        />
        <Button disabled={disabled || saving === `mapping:${subject.id}`} size="sm" type="submit">
          {saving === `mapping:${subject.id}` ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Save />
          )}{" "}
          Save
        </Button>
      </div>
      {enabled && data.assessments.length ? (
        <div className="mt-4 grid gap-2 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.assessments.map((assessment) => (
            <Field key={assessment.id} label={assessment.name}>
              <Input
                defaultValue={
                  limits.find((x) => x.assessmentId === assessment.id)?.maximumMarks ??
                  mapping?.maximumMarks ??
                  100
                }
                disabled={disabled}
                min="1"
                name={`assessment:${assessment.id}`}
                type="number"
              />
            </Field>
          ))}
        </div>
      ) : null}
    </form>
  );
}

function ViewButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Settings2;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground">{count} configured</p>
    </div>
  );
}
function DeleteButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Button
      aria-label="Delete"
      className="size-7 opacity-60 group-hover:opacity-100"
      disabled={disabled}
      onClick={onClick}
      size="icon"
      type="button"
      variant="ghost"
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}
function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
function NativeSelect({
  defaultValue,
  disabled,
  label,
  name,
  rows,
}: {
  defaultValue: string;
  disabled: boolean;
  label: string;
  name: string;
  rows: Catalog[];
}) {
  return (
    <Field label={label}>
      <select
        className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
      >
        <option value="">None</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
function blankSubject(): Subject {
  return {
    id: "",
    name: "",
    shortName: null,
    subjectTypeId: null,
    subjectHeadId: null,
    gradeTypeId: null,
    isOptional: false,
    passingPercentage: null,
    isActive: true,
    sourceSystem: "tsewa",
  };
}
function nullable(value: FormDataEntryValue | null) {
  return typeof value === "string" && value ? value : null;
}
function formText(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
function message(reason: unknown) {
  return reason instanceof Error ? reason.message : "Academic configuration could not be saved.";
}
