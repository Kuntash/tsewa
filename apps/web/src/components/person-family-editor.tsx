import {
  ArrowLeft,
  Link2,
  LoaderCircle,
  Save,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import type { PersonFamilyDetails, SiblingRelationship } from "@/components/person-profile-sheet";
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
import { Separator } from "@/components/ui/separator";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type FamilyForm = { [Field in keyof PersonFamilyDetails]: string };

type PersonOption = {
  id: string;
  displayName: string;
  primaryIdentifier: string;
  identifierKind: "admission" | "staff";
  kind: "child" | "elderly" | "staff";
  status: "active" | "inactive";
};

const emptyFamily: FamilyForm = {
  parentageStatus: "",
  motherName: "",
  fatherName: "",
  motherOccupation: "",
  fatherOccupation: "",
  parentsPhone: "",
  parentsPermanentAddress: "",
  guardian1Name: "",
  guardian1Address: "",
  guardian1Email: "",
  guardian1Phone: "",
  guardian1Mobile: "",
  guardian2Name: "",
  guardian2Address: "",
  guardian2Email: "",
  guardian2Phone: "",
  guardian2Mobile: "",
  maritalStatus: "",
  spouseName: "",
  numberOfChildren: "",
};

export function PersonFamilyEditor({
  family,
  onChanged,
  onDone,
  personId,
  personName,
  relationships,
}: {
  family: PersonFamilyDetails | null;
  onChanged: () => Promise<void>;
  onDone: () => void;
  personId: string;
  personName: string;
  relationships: SiblingRelationship[];
}) {
  const [details, setDetails] = useState<FamilyForm>(() => familyToForm(family));
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [options, setOptions] = useState<PersonOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [showNewSibling, setShowNewSibling] = useState(false);
  const [newSiblingName, setNewSiblingName] = useState("");
  const [newSiblingIdentifier, setNewSiblingIdentifier] = useState("");
  const [newSiblingGender, setNewSiblingGender] = useState<"female" | "male" | "other" | "unknown">(
    "unknown",
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setDetails(familyToForm(family)), [family]);

  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setOptions([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    void fetch(`/api/people/${personId}/sibling-options?q=${encodeURIComponent(debouncedSearch)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as { error?: string; people?: PersonOption[] };
        if (!response.ok) throw new Error(payload.error ?? "The search could not be completed.");
        setOptions(payload.people ?? []);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "The search could not be completed.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });
    return () => controller.abort();
  }, [debouncedSearch, personId]);

  function updateField(field: keyof FamilyForm, value: string) {
    setDetails((current) => ({ ...current, [field]: value }));
  }

  async function saveFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("family");
    setError("");
    try {
      const response = await fetch(`/api/people/${personId}/family`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          Object.fromEntries(
            Object.entries(details).map(([field, value]) => [field, value.trim() || null]),
          ),
        ),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The family details could not be saved.");
      await onChanged();
      toast.success("Family details saved.");
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "The family details could not be saved.",
      );
    } finally {
      setBusy("");
    }
  }

  async function linkExisting(option: PersonOption) {
    setBusy(`link-${option.id}`);
    setError("");
    try {
      await writeSibling(personId, { mode: "existing", relatedPersonId: option.id });
      setSearch("");
      setOptions([]);
      await onChanged();
      toast.success(`${option.displayName} linked as a sibling.`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "The sibling could not be linked.");
    } finally {
      setBusy("");
    }
  }

  async function createSibling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("new-sibling");
    setError("");
    try {
      await writeSibling(personId, {
        mode: "new",
        displayName: newSiblingName,
        primaryIdentifier: newSiblingIdentifier,
        gender: newSiblingGender,
      });
      setNewSiblingName("");
      setNewSiblingIdentifier("");
      setNewSiblingGender("unknown");
      setShowNewSibling(false);
      await onChanged();
      toast.success("The new person was created and linked as a sibling.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "The sibling could not be created.");
    } finally {
      setBusy("");
    }
  }

  async function removeSibling(relationship: SiblingRelationship) {
    if (!window.confirm(`Remove the sibling link with ${relationship.displayName}?`)) return;
    setBusy(`remove-${relationship.id}`);
    setError("");
    try {
      const response = await fetch(`/api/people/${personId}/siblings/${relationship.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The sibling link could not be removed.");
      await onChanged();
      toast.success(`Sibling link with ${relationship.displayName} removed.`);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "The sibling link could not be removed.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b bg-[radial-gradient(circle_at_top_left,var(--color-accent),transparent_65%)] px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
          Family and relationships
        </p>
        <h2 className="mt-5 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
          Edit {personName}&apos;s family
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          Update parent and guardian details, or manage sibling links.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
        <div className="space-y-8">
          {error ? (
            <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <form className="space-y-8" noValidate onSubmit={saveFamily}>
            <EditorSection title="Parents">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Mother's name"
                  onChange={(value) => updateField("motherName", value)}
                  value={details.motherName}
                />
                <TextField
                  label="Mother's occupation"
                  onChange={(value) => updateField("motherOccupation", value)}
                  value={details.motherOccupation}
                />
                <TextField
                  label="Father's name"
                  onChange={(value) => updateField("fatherName", value)}
                  value={details.fatherName}
                />
                <TextField
                  label="Father's occupation"
                  onChange={(value) => updateField("fatherOccupation", value)}
                  value={details.fatherOccupation}
                />
                <TextField
                  label="Family phone"
                  onChange={(value) => updateField("parentsPhone", value)}
                  type="tel"
                  value={details.parentsPhone}
                />
                <TextField
                  label="Parents' status"
                  onChange={(value) => updateField("parentageStatus", value)}
                  value={details.parentageStatus}
                />
                <TextField
                  className="sm:col-span-2"
                  label="Permanent address"
                  onChange={(value) => updateField("parentsPermanentAddress", value)}
                  value={details.parentsPermanentAddress}
                />
              </div>
            </EditorSection>

            <Separator />

            <EditorSection title="Primary guardian">
              <GuardianFields details={details} index={1} updateField={updateField} />
            </EditorSection>

            <Separator />

            <EditorSection title="Secondary guardian">
              <GuardianFields details={details} index={2} updateField={updateField} />
            </EditorSection>

            <Separator />

            <EditorSection title="Household">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Marital status"
                  onChange={(value) => updateField("maritalStatus", value)}
                  value={details.maritalStatus}
                />
                <TextField
                  label="Spouse's name"
                  onChange={(value) => updateField("spouseName", value)}
                  value={details.spouseName}
                />
                <TextField
                  label="Number of children"
                  onChange={(value) => updateField("numberOfChildren", value)}
                  value={details.numberOfChildren}
                />
              </div>
            </EditorSection>

            <div className="flex justify-end">
              <Button disabled={Boolean(busy)} type="submit">
                {busy === "family" ? <LoaderCircle className="animate-spin" /> : <Save />}
                {busy === "family" ? "Saving…" : "Save family details"}
              </Button>
            </div>
          </form>

          <Separator />

          <EditorSection title="Siblings">
            <div className="space-y-4">
              {relationships.length ? (
                <div className="overflow-hidden rounded-2xl border">
                  {relationships.map((relationship, index) => (
                    <div
                      className={`flex items-center gap-3 bg-card px-4 py-3 ${index ? "border-t" : ""}`}
                      key={relationship.id}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{relationship.displayName}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {relationship.identifierKind === "staff" ? "Staff" : "Admission"} ·{" "}
                          {relationship.primaryIdentifier}
                        </p>
                      </div>
                      <Button
                        aria-label={`Remove sibling link with ${relationship.displayName}`}
                        disabled={Boolean(busy)}
                        onClick={() => void removeSibling(relationship)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        {busy === `remove-${relationship.id}` ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <Trash2 />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
                  No siblings linked yet.
                </p>
              )}

              <div>
                <Label htmlFor="sibling-search">Link an existing person</Label>
                <div className="relative mt-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    id="sibling-search"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name or admission number"
                    value={search}
                  />
                </div>
                {search.length > 0 && search.length < 2 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Enter at least two characters.
                  </p>
                ) : null}
                {searching ? (
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <LoaderCircle className="size-3.5 animate-spin" /> Searching…
                  </p>
                ) : options.length ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border">
                    {options.map((option, index) => (
                      <div
                        className={`flex items-center gap-3 bg-card px-4 py-3 ${index ? "border-t" : ""}`}
                        key={option.id}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{option.displayName}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {option.primaryIdentifier}
                          </p>
                        </div>
                        <Button
                          disabled={Boolean(busy)}
                          onClick={() => void linkExisting(option)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {busy === `link-${option.id}` ? (
                            <LoaderCircle className="animate-spin" />
                          ) : (
                            <Link2 />
                          )}
                          Link
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : debouncedSearch.length >= 2 && !searching ? (
                  <p className="mt-3 text-xs text-muted-foreground">No matching people found.</p>
                ) : null}
              </div>

              {showNewSibling ? (
                <form
                  className="space-y-4 rounded-2xl border bg-muted/20 p-4"
                  onSubmit={createSibling}
                >
                  <div>
                    <h4 className="text-sm font-semibold">Create and link a new person</h4>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Use this only when the sibling does not already appear in People.
                    </p>
                  </div>
                  <TextField
                    label="Full name"
                    onChange={setNewSiblingName}
                    required
                    value={newSiblingName}
                  />
                  <TextField
                    label="Admission number"
                    onChange={setNewSiblingIdentifier}
                    required
                    value={newSiblingIdentifier}
                  />
                  <div>
                    <Label htmlFor="new-sibling-gender">Gender</Label>
                    <Select
                      onValueChange={(value) =>
                        setNewSiblingGender(value as typeof newSiblingGender)
                      }
                      value={newSiblingGender}
                    >
                      <SelectTrigger className="mt-2 w-full" id="new-sibling-gender">
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
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      disabled={Boolean(busy)}
                      onClick={() => setShowNewSibling(false)}
                      type="button"
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                    <Button disabled={Boolean(busy)} type="submit">
                      {busy === "new-sibling" ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <UserPlus />
                      )}
                      {busy === "new-sibling" ? "Creating…" : "Create and link"}
                    </Button>
                  </div>
                </form>
              ) : (
                <Button onClick={() => setShowNewSibling(true)} type="button" variant="outline">
                  <UserPlus /> Create a new person
                </Button>
              )}
            </div>
          </EditorSection>
        </div>
      </div>

      <footer className="flex flex-col-reverse gap-2 border-t bg-background/95 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <UsersRound className="size-4 text-primary" /> Sibling links appear on both profiles.
        </p>
        <Button disabled={Boolean(busy)} onClick={onDone} type="button" variant="outline">
          <ArrowLeft /> Back to profile
        </Button>
      </footer>
    </div>
  );
}

function GuardianFields({
  details,
  index,
  updateField,
}: {
  details: FamilyForm;
  index: 1 | 2;
  updateField: (field: keyof FamilyForm, value: string) => void;
}) {
  const fields =
    index === 1
      ? {
          name: "guardian1Name" as const,
          address: "guardian1Address" as const,
          email: "guardian1Email" as const,
          phone: "guardian1Phone" as const,
          mobile: "guardian1Mobile" as const,
        }
      : {
          name: "guardian2Name" as const,
          address: "guardian2Address" as const,
          email: "guardian2Email" as const,
          phone: "guardian2Phone" as const,
          mobile: "guardian2Mobile" as const,
        };
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        id={`guardian-${index}-name`}
        label="Name"
        onChange={(value) => updateField(fields.name, value)}
        value={details[fields.name]}
      />
      <TextField
        id={`guardian-${index}-email`}
        label="Email"
        onChange={(value) => updateField(fields.email, value)}
        type="email"
        value={details[fields.email]}
      />
      <TextField
        id={`guardian-${index}-phone`}
        label="Phone"
        onChange={(value) => updateField(fields.phone, value)}
        type="tel"
        value={details[fields.phone]}
      />
      <TextField
        id={`guardian-${index}-mobile`}
        label="Mobile"
        onChange={(value) => updateField(fields.mobile, value)}
        type="tel"
        value={details[fields.mobile]}
      />
      <TextField
        className="sm:col-span-2"
        id={`guardian-${index}-address`}
        label="Address"
        onChange={(value) => updateField(fields.address, value)}
        value={details[fields.address]}
      />
    </div>
  );
}

function EditorSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section>
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function TextField({
  className,
  id: suppliedId,
  label,
  onChange,
  required = false,
  type = "text",
  value,
}: {
  className?: string;
  id?: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "email" | "tel" | "text";
  value: string;
}) {
  const id = suppliedId ?? `family-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={className}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        className="mt-2"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </div>
  );
}

function familyToForm(family: PersonFamilyDetails | null): FamilyForm {
  if (!family) return { ...emptyFamily };
  return Object.fromEntries(
    Object.keys(emptyFamily).map((field) => [
      field,
      family[field as keyof PersonFamilyDetails] ?? "",
    ]),
  ) as FamilyForm;
}

async function writeSibling(
  personId: string,
  body:
    | { mode: "existing"; relatedPersonId: string }
    | {
        mode: "new";
        displayName: string;
        primaryIdentifier: string;
        gender: "female" | "male" | "other" | "unknown";
      },
): Promise<void> {
  const response = await fetch(`/api/people/${personId}/siblings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "The sibling could not be linked.");
}
