import { BookOpenCheck, LoaderCircle, Plus, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

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
import { assessmentMaximum, subjectsForClass } from "@/lib/academic-results";

type Option = { id: string; name: string };
type ClassOption = Option & { schoolId: string };
type Assessment = Option & { termId: string };
type Student = Option & {
  admissionNumber: string;
  schoolId: string;
  academicClassId: string;
};
type Setup = {
  session: Option;
  schools: Option[];
  classes: ClassOption[];
  subjects: Array<Option & { shortName: string | null }>;
  terms: Option[];
  assessments: Assessment[];
  students: Student[];
  classSubjects: Array<{
    academicClassId: string;
    subjectId: string;
    maximumMarks: number | null;
    displayOrder: number | null;
  }>;
  assessmentLimits: Array<{
    academicClassId: string;
    subjectId: string;
    assessmentId: string;
    maximumMarks: number | null;
  }>;
  capabilities: { manage: boolean };
};
type EditableSheet = {
  sheet: {
    id: string;
    sessionId: string;
    schoolId: string;
    academicClassId: string;
    subjectId: string;
    termId: string;
    recordedOn: string | null;
    status: string;
    sourceSystem: string;
  };
  marks: Array<{
    personId: string;
    assessmentId: string;
    marks: number | null;
    maximumMarks: number | null;
  }>;
  capabilities: { edit: boolean };
};

export function MarkEntrySheet({
  editId,
  onOpenChange,
  onSaved,
  open,
  sessionId,
}: {
  editId?: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
  open: boolean;
  sessionId: string;
}) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [error, setError] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [termId, setTermId] = useState("");
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [maximums, setMaximums] = useState<Record<string, string>>({});
  const [recordedOn, setRecordedOn] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) return;
    if (!editId) {
      setMarks({});
      setMaximums({});
      setRecordedOn(new Date().toISOString().slice(0, 10));
    }
    void loadSetup();
  }, [editId, open, sessionId]);

  async function loadSetup(preferred?: { subjectId?: string; termId?: string }) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/school-operations/results/setup?${new URLSearchParams({ sessionId })}`,
      );
      const payload = (await response.json()) as Setup & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Result setup could not be loaded.");
      setSetup(payload);
      if (editId) {
        const sheetResponse = await fetch(`/api/school-operations/results/${editId}`);
        const editable = (await sheetResponse.json()) as EditableSheet & { error?: string };
        if (!sheetResponse.ok)
          throw new Error(editable.error ?? "The draft mark sheet could not be loaded.");
        if (!editable.capabilities.edit)
          throw new Error("This mark sheet is no longer editable. Reopen it to draft first.");
        setSchoolId(editable.sheet.schoolId);
        setClassId(editable.sheet.academicClassId);
        setSubjectId(editable.sheet.subjectId);
        setTermId(editable.sheet.termId);
        setRecordedOn(editable.sheet.recordedOn ?? new Date().toISOString().slice(0, 10));
        setMarks(
          Object.fromEntries(
            editable.marks.map((mark) => [
              entryKey(mark.personId, mark.assessmentId),
              mark.marks === null ? "" : String(mark.marks),
            ]),
          ),
        );
        setMaximums(
          Object.fromEntries(
            editable.marks.map((mark) => [mark.assessmentId, String(mark.maximumMarks ?? 100)]),
          ),
        );
        return;
      }
      const nextSchool = schoolId || payload.schools[0]?.id || "";
      const nextClass =
        (classId &&
        payload.classes.some((item) => item.id === classId && item.schoolId === nextSchool)
          ? classId
          : payload.classes.find((item) => item.schoolId === nextSchool)?.id) ?? "";
      setSchoolId(nextSchool);
      setClassId(nextClass);
      setSubjectId(preferred?.subjectId || subjectId || payload.subjects[0]?.id || "");
      setTermId(preferred?.termId || termId || payload.terms[0]?.id || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Result setup could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  const classOptions = useMemo(
    () => setup?.classes.filter((item) => item.schoolId === schoolId) ?? [],
    [schoolId, setup],
  );
  const assessmentOptions = useMemo(
    () => setup?.assessments.filter((item) => item.termId === termId) ?? [],
    [setup, termId],
  );
  const subjectOptions = useMemo(() => {
    if (!setup) return [];
    return subjectsForClass(setup.subjects, setup.classSubjects, classId);
  }, [classId, setup]);
  const studentOptions = useMemo(
    () =>
      setup?.students.filter(
        (item) => item.schoolId === schoolId && item.academicClassId === classId,
      ) ?? [],
    [classId, schoolId, setup],
  );

  useEffect(() => {
    setMaximums((current) => {
      const next = { ...current };
      for (const assessment of assessmentOptions) {
        const configured = assessmentMaximum(
          setup?.assessmentLimits ?? [],
          classId,
          subjectId,
          assessment.id,
          Number(next[assessment.id] ?? 100),
        );
        next[assessment.id] = String(configured);
      }
      return next;
    });
  }, [assessmentOptions, classId, setup, subjectId]);

  useEffect(() => {
    if (!editId && subjectOptions.length && !subjectOptions.some((item) => item.id === subjectId))
      setSubjectId(subjectOptions[0].id);
  }, [editId, subjectId, subjectOptions]);

  async function createCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const assessmentValue = data.get("assessments");
    const assessments = (typeof assessmentValue === "string" ? assessmentValue : "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    try {
      const response = await fetch("/api/school-operations/results/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          subject: {
            name: data.get("subjectName"),
            shortName: data.get("shortName") || null,
            passingPercentage: data.get("passingPercentage")
              ? Number(data.get("passingPercentage"))
              : null,
            isOptional: false,
          },
          term: { name: data.get("termName") },
          assessments,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        subjectId?: string;
        termId?: string;
      };
      if (!response.ok || !payload.subjectId || !payload.termId) {
        throw new Error(payload.error ?? "The result setup could not be created.");
      }
      setCatalogOpen(false);
      await loadSetup({ subjectId: payload.subjectId, termId: payload.termId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The result setup could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveMarkSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const entries = studentOptions.flatMap((student) =>
      assessmentOptions.map((assessment) => {
        const raw = marks[entryKey(student.id, assessment.id)]?.trim() ?? "";
        return {
          personId: student.id,
          assessmentId: assessment.id,
          marks: raw === "" ? null : Number(raw),
          maximumMarks: Number(maximums[assessment.id] || 100),
          note: null,
        };
      }),
    );
    try {
      const response = await fetch(
        editId ? `/api/school-operations/results/${editId}` : "/api/school-operations/results",
        {
          method: editId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId,
            schoolId,
            academicClassId: classId,
            subjectId,
            termId,
            recordedOn,
            maximumMarks: assessmentOptions.reduce(
              (total, item) => total + Number(maximums[item.id] || 100),
              0,
            ),
            marks: entries,
          }),
        },
      );
      const payload = (await response.json()) as { error?: string; id?: string };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error ?? "The mark sheet could not be saved.");
      }
      onSaved(
        editId
          ? `Draft mark sheet updated for ${studentOptions.length} students.`
          : `Draft mark sheet saved for ${studentOptions.length} students.`,
      );
      onOpenChange(false);
      setMarks({});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The mark sheet could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  const ready = Boolean(
    schoolId && classId && subjectId && termId && studentOptions.length && assessmentOptions.length,
  );
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-5xl">
        <div className="sticky top-0 z-10 border-b bg-background/95 px-5 py-5 pr-16 backdrop-blur sm:px-7">
          <div className="flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <BookOpenCheck className="size-5" />
            </div>
            <div>
              <SheetTitle>{editId ? "Edit draft mark ledger" : "Class mark ledger"}</SheetTitle>
              <SheetDescription className="mt-1.5">
                {editId ? "Correct marks before verification" : "Enter a complete draft"} for{" "}
                {setup?.session.name ?? "the active session"}. Drafts can be checked before they are
                verified and locked.
              </SheetDescription>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-80 place-items-center text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <LoaderCircle className="size-4 animate-spin" /> Loading the class ledger…
            </span>
          </div>
        ) : (
          <div className="p-5 sm:p-7">
            {error ? (
              <p className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {catalogOpen ? (
              <CatalogForm
                disabled={submitting}
                onCancel={() => setCatalogOpen(false)}
                onSubmit={createCatalog}
              />
            ) : (
              <form onSubmit={(event) => void saveMarkSheet(event)}>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">Result scope</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      One sheet per class, subject, and term.
                    </p>
                  </div>
                  {!editId ? (
                    <Button
                      onClick={() => setCatalogOpen(true)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Plus className="size-4" /> Add subject setup
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-4 rounded-2xl border bg-muted/20 p-4 md:grid-cols-3">
                  <Choice
                    label="School"
                    disabled={Boolean(editId)}
                    onChange={(value) => {
                      setSchoolId(value);
                      setClassId(setup?.classes.find((item) => item.schoolId === value)?.id ?? "");
                    }}
                    options={setup?.schools ?? []}
                    value={schoolId}
                  />
                  <Choice
                    label="Class"
                    disabled={Boolean(editId)}
                    onChange={setClassId}
                    options={classOptions}
                    value={classId}
                  />
                  <Choice
                    label="Subject"
                    disabled={Boolean(editId)}
                    onChange={setSubjectId}
                    options={subjectOptions}
                    value={subjectId}
                  />
                  <Choice
                    label="Term"
                    disabled={Boolean(editId)}
                    onChange={setTermId}
                    options={setup?.terms ?? []}
                    value={termId}
                  />
                  <div className="space-y-2">
                    <Label htmlFor="mark-recorded-on">Recorded on</Label>
                    <Input
                      id="mark-recorded-on"
                      name="recordedOn"
                      onChange={(event) => setRecordedOn(event.target.value)}
                      required
                      type="date"
                      value={recordedOn}
                    />
                  </div>
                  <div className="rounded-xl border border-dashed px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                    {studentOptions.length} students · {assessmentOptions.length} assessments
                  </div>
                </div>

                {!subjectOptions.length ? (
                  <EmptySetup onCreate={() => setCatalogOpen(true)} />
                ) : !assessmentOptions.length ? (
                  <EmptySetup
                    onCreate={() => setCatalogOpen(true)}
                    text="This term has no assessments yet."
                  />
                ) : !studentOptions.length ? (
                  <div className="my-8 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No active students are enrolled in this school and class.
                  </div>
                ) : (
                  <div className="mt-6 overflow-x-auto rounded-2xl border">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-muted/50 text-left">
                        <tr>
                          <th className="sticky left-0 z-[1] min-w-52 bg-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Student
                          </th>
                          {assessmentOptions.map((assessment) => (
                            <th className="min-w-36 px-3 py-3" key={assessment.id}>
                              <span className="block text-xs font-semibold">{assessment.name}</span>
                              <label className="mt-1 flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                                Out of
                                <Input
                                  className="h-7 w-16 px-2 text-xs"
                                  disabled={setup?.assessmentLimits.some(
                                    (item) =>
                                      item.academicClassId === classId &&
                                      item.subjectId === subjectId &&
                                      item.assessmentId === assessment.id &&
                                      item.maximumMarks !== null,
                                  )}
                                  min="1"
                                  onChange={(event) =>
                                    setMaximums((value) => ({
                                      ...value,
                                      [assessment.id]: event.target.value,
                                    }))
                                  }
                                  type="number"
                                  value={maximums[assessment.id] ?? "100"}
                                />
                              </label>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {studentOptions.map((student, index) => (
                          <tr className="hover:bg-muted/20" key={student.id}>
                            <td className="sticky left-0 bg-background px-4 py-3">
                              <p className="font-medium">{student.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {student.admissionNumber || `Student ${index + 1}`}
                              </p>
                            </td>
                            {assessmentOptions.map((assessment) => (
                              <td className="px-3 py-2" key={assessment.id}>
                                <Input
                                  aria-label={`${student.name}, ${assessment.name}`}
                                  className="h-9 tabular-nums"
                                  max={maximums[assessment.id] ?? "100"}
                                  min="0"
                                  onChange={(event) =>
                                    setMarks((value) => ({
                                      ...value,
                                      [entryKey(student.id, assessment.id)]: event.target.value,
                                    }))
                                  }
                                  placeholder="—"
                                  step="0.01"
                                  type="number"
                                  value={marks[entryKey(student.id, assessment.id)] ?? ""}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between border-t pt-5">
                  <p className="max-w-md text-xs leading-5 text-muted-foreground">
                    Empty cells remain unrecorded. Saving {editId ? "updates" : "creates"} a draft;
                    it does not publish the result.
                  </p>
                  <Button disabled={!ready || submitting} type="submit">
                    {submitting ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    {editId ? "Update draft" : "Save draft"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CatalogForm({
  disabled,
  onCancel,
  onSubmit,
}: {
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="mx-auto max-w-2xl space-y-5" onSubmit={onSubmit}>
      <div className="rounded-2xl border bg-muted/20 p-5">
        <h3 className="font-semibold">Add a subject result setup</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Create the subject, its term, and assessment columns together.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Subject name" name="subjectName" placeholder="Mathematics" required />
          <Field label="Short name" name="shortName" placeholder="Maths" />
          <Field label="Term" name="termName" placeholder="First term" required />
          <Field
            label="Passing percentage"
            max="100"
            min="0"
            name="passingPercentage"
            placeholder="40"
            type="number"
          />
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="catalog-assessments">Assessments</Label>
            <Input
              id="catalog-assessments"
              name="assessments"
              placeholder="Unit test, Midterm, Final examination"
              required
            />
            <p className="text-xs text-muted-foreground">Separate assessment names with commas.</p>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button disabled={disabled} onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <Button disabled={disabled} type="submit">
          {disabled ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}{" "}
          Create setup
        </Button>
      </div>
    </form>
  );
}

function Choice({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: Option[];
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select disabled={disabled} onValueChange={onChange} value={value}>
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

function Field(props: { label: string; name: string; [key: string]: unknown }) {
  const { label, name, ...inputProps } = props;
  return (
    <div className="space-y-2">
      <Label htmlFor={`catalog-${name}`}>{label}</Label>
      <Input id={`catalog-${name}`} name={name} {...inputProps} />
    </div>
  );
}

function EmptySetup({
  onCreate,
  text = "No subjects have been configured for this session.",
}: {
  onCreate: () => void;
  text?: string;
}) {
  return (
    <div className="my-8 rounded-2xl border border-dashed p-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button className="mt-4" onClick={onCreate} size="sm" type="button" variant="outline">
        <Plus className="size-4" /> Create result setup
      </Button>
    </div>
  );
}

function entryKey(personId: string, assessmentId: string) {
  return `${personId}:${assessmentId}`;
}
