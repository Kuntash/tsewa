import { Building2, LoaderCircle, Save } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

export type EditableSchool = {
  id: string;
  name: string;
  locationName: string | null;
  affiliationNumber: string | null;
  isActive: boolean;
};

export function SchoolEditorSheet({
  onOpenChange,
  onSaved,
  open,
  school,
}: {
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
  open: boolean;
  school: EditableSchool | null;
}) {
  const [name, setName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [affiliationNumber, setAffiliationNumber] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(school?.name ?? "");
    setLocationName(school?.locationName ?? "");
    setAffiliationNumber(school?.affiliationNumber ?? "");
    setIsActive(school?.isActive ?? true);
    setError("");
  }, [open, school]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        school ? `/api/school-operations/schools/${school.id}` : "/api/school-operations/schools",
        {
          method: school ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name,
            locationName: locationName.trim() || null,
            affiliationNumber: affiliationNumber.trim() || null,
            isActive,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "The school could not be saved.");
      onSaved(school ? `${name.trim()} was updated.` : `${name.trim()} was added.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The school could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent>
        <SheetTitle className="sr-only">{school ? "Edit school" : "Add school"}</SheetTitle>
        <SheetDescription className="sr-only">
          Add or update the school name, location, affiliation number, and status.
        </SheetDescription>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={save}>
          <header className="border-b bg-[radial-gradient(circle_at_top_left,var(--color-accent),transparent_65%)] px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
              {school ? "Edit school" : "Add school"}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              This school will be available when admitting or moving students.
            </p>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
            {error ? (
              <p className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="space-y-5">
              <Field htmlFor="school-name" label="School name" required>
                <Input
                  autoFocus
                  id="school-name"
                  maxLength={160}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </Field>
              <Field htmlFor="school-location" label="Location">
                <Input
                  id="school-location"
                  maxLength={160}
                  onChange={(event) => setLocationName(event.target.value)}
                  value={locationName}
                />
              </Field>
              <Field htmlFor="school-affiliation" label="Affiliation number">
                <Input
                  id="school-affiliation"
                  maxLength={100}
                  onChange={(event) => setAffiliationNumber(event.target.value)}
                  value={affiliationNumber}
                />
              </Field>
              <label className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3">
                <input
                  checked={isActive}
                  className="mt-0.5 size-4 accent-primary"
                  onChange={(event) => setIsActive(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <span className="block text-sm font-medium">Active school</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Active schools can be selected for new admissions and student changes.
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
              {saving ? "Saving…" : "Save school"}
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
  children: React.ReactNode;
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
