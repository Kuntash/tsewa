import {
  CheckCircle2,
  GraduationCap,
  History,
  LoaderCircle,
  LogOut,
  MoveRight,
  PencilLine,
  School,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

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

type Option = { id: string; name: string };
type Action =
  | "placement_changed"
  | "internal_transfer"
  | "transferred_out"
  | "withdrawn"
  | "completed";

type Enrollment = {
  id: string;
  personId: string;
  displayName: string;
  admissionNumber: string;
  sessionName: string;
  sessionStartsOn: string;
  sessionEndsOn: string;
  schoolId: string | null;
  schoolName: string | null;
  academicClassId: string;
  className: string;
  houseId: string | null;
  houseName: string | null;
  rollNumber: string | null;
  status: string;
  canEdit: boolean;
};

type Change = {
  id: string;
  changeType: "admitted" | "placement_changed" | "transferred" | "withdrawn" | "completed";
  effectiveOn: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  fromSchoolName: string | null;
  toSchoolName: string | null;
  fromClassName: string | null;
  toClassName: string | null;
  fromHouseName: string | null;
  toHouseName: string | null;
  fromRollNumber: string | null;
  toRollNumber: string | null;
  changedBy: string | null;
};

type EnrollmentResponse = {
  enrollment: Enrollment;
  options: { schools: Option[]; classes: Option[]; houses: Option[] };
  changes: Change[];
};

const actions: Array<{
  value: Action;
  label: string;
  description: string;
  icon: typeof PencilLine;
}> = [
  {
    value: "placement_changed",
    label: "Change class or house",
    description: "The student stays enrolled in the same school.",
    icon: PencilLine,
  },
  {
    value: "internal_transfer",
    label: "Move to another school",
    description: "Move between schools managed in this organization.",
    icon: School,
  },
  {
    value: "transferred_out",
    label: "Transfer out",
    description: "The student is leaving for a different organization.",
    icon: MoveRight,
  },
  {
    value: "withdrawn",
    label: "Withdraw",
    description: "The student leaves before completing school.",
    icon: LogOut,
  },
  {
    value: "completed",
    label: "Complete school",
    description: "The student has finished their schooling.",
    icon: GraduationCap,
  },
];

export function EnrollmentChangeSheet({
  enrollmentId,
  onOpenChange,
  onSaved,
  open,
}: {
  enrollmentId: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
  open: boolean;
}) {
  const [data, setData] = useState<EnrollmentResponse | null>(null);
  const [action, setAction] = useState<Action>("placement_changed");
  const [schoolId, setSchoolId] = useState("");
  const [academicClassId, setAcademicClassId] = useState("");
  const [houseId, setHouseId] = useState("none");
  const [rollNumber, setRollNumber] = useState("");
  const [effectiveOn, setEffectiveOn] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !enrollmentId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(`/api/school-operations/enrollments/${enrollmentId}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as EnrollmentResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Enrollment could not be loaded.");
        return payload;
      })
      .then((payload) => {
        setData(payload);
        setAction("placement_changed");
        setSchoolId(payload.enrollment.schoolId ?? "");
        setAcademicClassId(payload.enrollment.academicClassId);
        setHouseId(payload.enrollment.houseId ?? "none");
        setRollNumber(payload.enrollment.rollNumber ?? "");
        setEffectiveOn(dateWithinSession(payload.enrollment));
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Enrollment could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [enrollmentId, open]);

  const selectedAction = actions.find((item) => item.value === action) ?? actions[0];
  const keepsStudentEnrolled = action === "placement_changed" || action === "internal_transfer";
  const confirmation = useMemo(() => {
    if (!data) return "";
    if (action === "placement_changed") {
      const className = data.options.classes.find((item) => item.id === academicClassId)?.name;
      const houseName = data.options.houses.find((item) => item.id === houseId)?.name;
      return `${data.enrollment.displayName} will stay enrolled in ${className ?? "the selected class"}${houseName ? `, ${houseName}` : ""}.`;
    }
    if (action === "internal_transfer") {
      const schoolName = data.options.schools.find((item) => item.id === schoolId)?.name;
      return `${data.enrollment.displayName} will move to ${schoolName ?? "the selected school"} and remain enrolled.`;
    }
    return `${data.enrollment.displayName}'s enrollment will end on ${effectiveOn || "the selected date"}. Their records will remain available.`;
  }, [academicClassId, action, data, effectiveOn, houseId, schoolId]);

  function chooseAction(value: Action) {
    setAction(value);
    setError("");
    if (value === "internal_transfer" && data) {
      setSchoolId(
        data.options.schools.find((school) => school.id !== data.enrollment.schoolId)?.id ?? "",
      );
    } else if (data) {
      setSchoolId(data.enrollment.schoolId ?? "");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollmentId) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/school-operations/enrollments/${enrollmentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        effectiveOn,
        schoolId: keepsStudentEnrolled ? schoolId : undefined,
        academicClassId: keepsStudentEnrolled ? academicClassId : undefined,
        houseId: keepsStudentEnrolled ? (houseId === "none" ? null : houseId) : undefined,
        rollNumber: keepsStudentEnrolled ? rollNumber || null : undefined,
        note: form.get("note") || undefined,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setSubmitting(false);
    if (!response.ok) {
      setError(payload.error ?? "The enrollment could not be changed.");
      return;
    }
    onSaved(
      `${data?.enrollment.displayName ?? "The student"}: ${selectedAction.label.toLowerCase()} saved.`,
    );
    onOpenChange(false);
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="overflow-y-auto sm:max-w-[720px]">
        <div className="border-b px-5 py-6 pr-16 sm:px-7">
          <div className="mb-4 flex items-center gap-2">
            <Badge className="rounded-full" variant="secondary">
              {data?.enrollment.sessionName ?? "Enrollment"}
            </Badge>
            {data?.enrollment.canEdit ? (
              <Badge className="rounded-full" variant="outline">
                Can edit
              </Badge>
            ) : null}
          </div>
          <SheetTitle>{data?.enrollment.displayName ?? "Change enrollment"}</SheetTitle>
          <SheetDescription className="mt-2 leading-6">
            {data
              ? `${data.enrollment.admissionNumber} · ${data.enrollment.schoolName ?? "School not set"} · ${data.enrollment.className}`
              : "Choose what changed and when it took effect."}
          </SheetDescription>
        </div>

        {loading ? (
          <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">
            <div className="text-center">
              <LoaderCircle className="mx-auto mb-3 size-5 animate-spin text-primary" />
              Loading enrollment…
            </div>
          </div>
        ) : data ? (
          <div className="divide-y">
            {data.enrollment.canEdit ? (
              <form className="space-y-6 p-5 sm:p-7" onSubmit={(event) => void submit(event)}>
                <div>
                  <Label>What changed?</Label>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {actions.map(({ description, icon: Icon, label, value }) => (
                      <button
                        className={`rounded-2xl border p-4 text-left transition-colors ${action === value ? "border-primary bg-primary/8" : "bg-card hover:border-primary/35"}`}
                        key={value}
                        onClick={() => chooseAction(value)}
                        type="button"
                      >
                        <Icon className="size-4 text-primary" />
                        <p className="mt-3 text-sm font-semibold">{label}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="effective-on">Effective date</Label>
                  <Input
                    id="effective-on"
                    max={data.enrollment.sessionEndsOn}
                    min={data.enrollment.sessionStartsOn}
                    onChange={(event) => setEffectiveOn(event.target.value)}
                    required
                    type="date"
                    value={effectiveOn}
                  />
                </div>

                {keepsStudentEnrolled ? (
                  <div className="grid gap-4 rounded-2xl border bg-muted/25 p-4 sm:grid-cols-2">
                    {action === "internal_transfer" ? (
                      <OptionField
                        label="New school"
                        onChange={setSchoolId}
                        options={data.options.schools}
                        value={schoolId}
                      />
                    ) : null}
                    <OptionField
                      label="Class"
                      onChange={setAcademicClassId}
                      options={data.options.classes}
                      value={academicClassId}
                    />
                    <div className="space-y-2">
                      <Label>House</Label>
                      <Select onValueChange={setHouseId} value={houseId}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No house</SelectItem>
                          {data.options.houses.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="roll-number">Roll number</Label>
                      <Input
                        id="roll-number"
                        onChange={(event) => setRollNumber(event.target.value)}
                        value={rollNumber}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="change-note">
                    {action === "transferred_out"
                      ? "Destination or note (optional)"
                      : "Reason or note (optional)"}
                  </Label>
                  <Input
                    id="change-note"
                    maxLength={500}
                    name="note"
                    placeholder={
                      action === "transferred_out"
                        ? "Example: Transferred to ABC School"
                        : "Add a short note"
                    }
                  />
                </div>

                {error ? (
                  <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <div className="rounded-2xl border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Before you save
                  </p>
                  <p className="mt-2 text-sm leading-6">{confirmation}</p>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
                    Cancel
                  </Button>
                  <Button
                    disabled={submitting}
                    type="submit"
                    variant={keepsStudentEnrolled ? "default" : "destructive"}
                  >
                    {submitting ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
                    Save change
                  </Button>
                </div>
              </form>
            ) : (
              <div className="p-5 sm:p-7">
                <p className="rounded-2xl border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
                  {data.enrollment.status === "enrolled"
                    ? "Imported enrollments are view only for now. Use the practice school to test changes."
                    : "This enrollment has ended and cannot be changed."}
                </p>
              </div>
            )}

            <EnrollmentHistory changes={data.changes} />
          </div>
        ) : (
          <div className="p-6">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EnrollmentHistory({ changes }: { changes: Change[] }) {
  return (
    <section className="p-5 sm:p-7">
      <div className="flex items-center gap-2">
        <History className="size-4 text-primary" />
        <h2 className="font-semibold">Enrollment history</h2>
      </div>
      <div className="mt-4 space-y-3">
        {changes.map((change) => (
          <div className="relative rounded-2xl border bg-card p-4" key={change.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{changeLabel(change.changeType)}</p>
              <time className="text-xs text-muted-foreground">
                {formatDate(change.effectiveOn)}
              </time>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {changeDescription(change)}
            </p>
            {change.note ? (
              <p className="mt-2 rounded-lg bg-muted/55 px-3 py-2 text-xs">{change.note}</p>
            ) : null}
            <p className="mt-3 text-[11px] text-muted-foreground">
              Saved by {change.changedBy ?? "Tsewa"}
            </p>
          </div>
        ))}
        {!changes.length ? (
          <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
        ) : null}
      </div>
    </section>
  );
}

function OptionField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Option[];
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select onValueChange={onChange} value={value}>
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

function dateWithinSession(enrollment: Enrollment): string {
  const today = new Date().toISOString().slice(0, 10);
  if (today < enrollment.sessionStartsOn) return enrollment.sessionStartsOn;
  if (today > enrollment.sessionEndsOn) return enrollment.sessionEndsOn;
  return today;
}

function changeLabel(type: Change["changeType"]): string {
  return {
    admitted: "Admitted",
    placement_changed: "Class or house changed",
    transferred: "Transferred",
    withdrawn: "Withdrawn",
    completed: "Completed school",
  }[type];
}

function changeDescription(change: Change): string {
  if (change.changeType === "admitted")
    return `Started in ${change.toSchoolName ?? "the school"}, ${change.toClassName ?? "class not set"}.`;
  if (change.changeType === "placement_changed")
    return `${change.fromClassName ?? "Previous class"} → ${change.toClassName ?? "new class"}${change.fromHouseName !== change.toHouseName ? ` · ${change.fromHouseName ?? "No house"} → ${change.toHouseName ?? "No house"}` : ""}${change.fromRollNumber !== change.toRollNumber ? ` · Roll ${change.fromRollNumber ?? "not set"} → ${change.toRollNumber ?? "not set"}` : ""}.`;
  if (change.changeType === "transferred" && change.fromSchoolName !== change.toSchoolName)
    return `${change.fromSchoolName ?? "Previous school"} → ${change.toSchoolName ?? "another school"}.`;
  if (change.changeType === "transferred") return "Transferred out of the organization.";
  if (change.changeType === "withdrawn") return "Enrollment ended as withdrawn.";
  return "Enrollment ended after completing school.";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
