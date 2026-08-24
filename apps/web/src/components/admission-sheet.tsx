import { LoaderCircle, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import type { ComponentProps, FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker";
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

type Option = { id: string; name: string; schoolId?: string };

type Setup = {
  canEdit: boolean;
  session: { id: string; name: string; startsOn: string; endsOn: string };
  schools: Option[];
  classes: Option[];
  houses: Option[];
};

export function AdmissionSheet({
  onCreated,
  onOpenChange,
  open,
  sessionId,
}: {
  onCreated: (personId: string, displayName: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  sessionId: string;
}) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [academicClassId, setAcademicClassId] = useState("");
  const [houseId, setHouseId] = useState("none");
  const [gender, setGender] = useState("unknown");
  const [admittedOn, setAdmittedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateOfBirth, setDateOfBirth] = useState("");

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(`/api/school-operations/setup?${new URLSearchParams({ sessionId })}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as Setup & { error?: string };
        if (!response.ok)
          throw new Error(payload.error ?? "Admission choices could not be loaded.");
        return payload;
      })
      .then((payload) => {
        setSetup(payload);
        const firstSchoolId = payload.schools[0]?.id ?? "";
        setSchoolId(firstSchoolId);
        setAcademicClassId(optionsForSchool(payload.classes, firstSchoolId)[0]?.id ?? "");
        setHouseId("none");
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : "Admission choices could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, sessionId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/school-operations/admissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId,
        admissionNumber: data.get("admissionNumber"),
        displayName: data.get("displayName"),
        dateOfBirth: data.get("dateOfBirth") || undefined,
        admittedOn: data.get("admittedOn"),
        rollNumber: data.get("rollNumber") || undefined,
        gender,
        educationNumber: data.get("educationNumber") || undefined,
        registrationCertificateNumber: data.get("registrationCertificateNumber") || undefined,
        identityCertificateNumber: data.get("identityCertificateNumber") || undefined,
        schoolId,
        academicClassId,
        houseId: houseId === "none" ? undefined : houseId,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      personId?: string;
      displayName?: string;
    };
    setSubmitting(false);
    if (!response.ok || !payload.personId || !payload.displayName) {
      setError(payload.error ?? "The student could not be admitted.");
      return;
    }
    onCreated(payload.personId, payload.displayName);
    onOpenChange(false);
  }

  const classOptions = optionsForSchool(setup?.classes ?? [], schoolId);
  const houseOptions = optionsForSchool(setup?.houses ?? [], schoolId);

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="overflow-y-auto">
        <div className="border-b px-5 py-6 pr-16 sm:px-7">
          <div className="mb-4 grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
            <UserPlus className="size-5" />
          </div>
          <SheetTitle>Admit a student</SheetTitle>
          <SheetDescription className="mt-2 leading-6">
            Add the student and place them in a class for {setup?.session.name ?? "this session"}.
          </SheetDescription>
        </div>

        {loading ? (
          <div className="grid flex-1 place-items-center p-10 text-sm text-muted-foreground">
            <LoaderCircle className="mb-3 size-5 animate-spin text-primary" />
            Loading admission form…
          </div>
        ) : (
          <form className="space-y-5 p-5 sm:p-7" onSubmit={(event) => void submit(event)}>
            {error ? (
              <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {!setup?.schools.length || !classOptions.length ? (
              <p className="rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                Assign at least one class to this school before admitting a student.
              </p>
            ) : null}
            <Field label="Student name" name="displayName" placeholder="Example Student" required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Admission number"
                name="admissionNumber"
                placeholder="TEST-001"
                required
              />
              <Field label="Roll number (optional)" name="rollNumber" placeholder="1" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DatePickerField
                label="Admission date"
                name="admittedOn"
                onChange={setAdmittedOn}
                required
                value={admittedOn}
              />
              <DatePickerField
                label="Date of birth (optional)"
                name="dateOfBirth"
                onChange={setDateOfBirth}
                value={dateOfBirth}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Education number (optional)"
                name="educationNumber"
                placeholder="Education number"
              />
              <Field
                label="RC number (optional)"
                name="registrationCertificateNumber"
                placeholder="RC number"
              />
              <Field
                label="IC number (optional)"
                name="identityCertificateNumber"
                placeholder="IC number"
              />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select onValueChange={setGender} value={gender}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Not recorded</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <OptionField
              label="School"
              onChange={(value) => {
                setSchoolId(value);
                setAcademicClassId(optionsForSchool(setup?.classes ?? [], value)[0]?.id ?? "");
                setHouseId("none");
              }}
              options={setup?.schools ?? []}
              value={schoolId}
            />
            <OptionField
              label="Class"
              onChange={setAcademicClassId}
              options={classOptions}
              value={academicClassId}
            />
            <div className="space-y-2">
              <Label>House (optional)</Label>
              <Select onValueChange={setHouseId} value={houseId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No house</SelectItem>
                  {houseOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
              <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={submitting || !schoolId || !academicClassId} type="submit">
                {submitting ? <LoaderCircle className="animate-spin" /> : <UserPlus />}
                Admit student
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function optionsForSchool(options: Option[], schoolId: string) {
  const names = new Set<string>();
  return options.filter((option) => {
    if (option.schoolId !== schoolId) return false;
    const key = option.name.trim().toLowerCase();
    if (names.has(key)) return false;
    names.add(key);
    return true;
  });
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
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
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
