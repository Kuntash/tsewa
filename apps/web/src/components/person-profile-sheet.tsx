import {
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  FileText,
  Fingerprint,
  GraduationCap,
  HeartHandshake,
  History,
  Home,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MapPinned,
  MapPin,
  Pencil,
  Phone,
  Save,
  UserRound,
  UsersRound,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

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
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { PersonFamilyEditor } from "@/components/person-family-editor";

export type PersonFamilyDetails = {
  parentageStatus: string | null;
  motherName: string | null;
  fatherName: string | null;
  motherOccupation: string | null;
  fatherOccupation: string | null;
  parentsPhone: string | null;
  parentsPermanentAddress: string | null;
  guardian1Name: string | null;
  guardian1Address: string | null;
  guardian1Email: string | null;
  guardian1Phone: string | null;
  guardian1Mobile: string | null;
  guardian2Name: string | null;
  guardian2Address: string | null;
  guardian2Email: string | null;
  guardian2Phone: string | null;
  guardian2Mobile: string | null;
  maritalStatus: string | null;
  spouseName: string | null;
  numberOfChildren: string | null;
};

export type SiblingRelationship = {
  id: string;
  relationshipType: "sibling";
  reviewFlag: "self_reference" | "duplicate_source_link" | null;
  personId: string;
  displayName: string;
  primaryIdentifier: string;
  identifierKind: "admission" | "staff";
  kind: "child" | "elderly" | "staff";
  status: "active" | "inactive";
};

type Profile = {
  id: string;
  kind: "child" | "elderly" | "staff";
  status: "active" | "inactive";
  identifierKind: "admission" | "staff";
  primaryIdentifier: string;
  displayName: string;
  gender: "female" | "male" | "other" | "unknown" | null;
  dateOfBirth: string | null;
  admittedOrJoinedOn: string | null;
  campusOrLocation: string | null;
  nationality: string | null;
  photoReferencePresent: boolean;
  sourceSystem: string;
  sourceTable: string;
  sourceId: string;
  importedAt: string | null;
  canEdit: boolean;
  editRestriction: "permission" | null;
  reviewFlags: string[];
  placements: Array<{
    id: string;
    homeName: string;
    locationName: string | null;
    placementType: string | null;
    startedOn: string;
    endedOn: string | null;
    reason: string | null;
    remarks: string | null;
    isCurrent: boolean;
    sourceId: string;
  }>;
  academicRecords: Array<{
    id: string;
    className: string;
    classLevel: number | null;
    classSection: string | null;
    classTitle: string | null;
    schoolName: string | null;
    houseName: string | null;
    academicSession: string;
    recordedOn: string;
    result: string | null;
    rollNumber: string | null;
    boardRegistrationNumber: string | null;
    description: string | null;
    isLatest: boolean;
    sourceId: string;
  }>;
  family: PersonFamilyDetails | null;
  relationships: SiblingRelationship[];
  files: Array<{
    id: string;
    category:
      | "profile_photo"
      | "parents_photo"
      | "guardian_1_photo"
      | "guardian_2_photo"
      | "document";
    label: string;
    fileName: string;
    contentType: string;
    byteSize: number;
    isPrimary: boolean;
    url: string;
  }>;
};

export function PersonProfileSheet({
  onOpenChange,
  onPersonUpdated,
  personId,
}: {
  onOpenChange: (open: boolean) => void;
  onPersonUpdated?: () => void;
  personId: string | null;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<"core" | "family" | "placement" | null>(null);

  useEffect(() => {
    if (!personId) {
      setProfile(null);
      setError("");
      setEditing(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    void readPersonProfile(personId, controller.signal)
      .then(setProfile)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "This profile could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [personId]);

  return (
    <Sheet open={Boolean(personId)} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle className="sr-only">Person profile</SheetTitle>
        <SheetDescription className="sr-only">Personal details and history.</SheetDescription>

        {loading ? (
          <div className="grid flex-1 place-items-center">
            <div className="text-center">
              <LoaderCircle className="mx-auto size-6 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Opening profile…</p>
            </div>
          </div>
        ) : error ? (
          <div className="grid flex-1 place-items-center px-6">
            <div className="max-w-sm rounded-2xl border border-destructive/20 bg-destructive/10 p-5 text-center">
              <p className="font-medium text-destructive">Profile unavailable</p>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : profile && editing === "core" ? (
          <PersonCoreDetailsForm
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              const updated = await readPersonProfile(profile.id);
              setProfile(updated);
              setEditing(null);
              onPersonUpdated?.();
            }}
            profile={profile}
          />
        ) : profile && editing === "family" ? (
          <PersonFamilyEditor
            family={profile.family}
            onChanged={async () => {
              const updated = await readPersonProfile(profile.id);
              setProfile(updated);
              onPersonUpdated?.();
            }}
            onDone={() => setEditing(null)}
            personId={profile.id}
            personName={profile.displayName}
            relationships={profile.relationships}
          />
        ) : profile && editing === "placement" ? (
          <PersonPlacementEditor
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              const updated = await readPersonProfile(profile.id);
              setProfile(updated);
              setEditing(null);
              onPersonUpdated?.();
            }}
            profile={profile}
          />
        ) : profile ? (
          <ProfileContent
            onEdit={() => setEditing("core")}
            onEditFamily={() => setEditing("family")}
            onEditPlacement={() => setEditing("placement")}
            profile={profile}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ProfileContent({
  onEdit,
  onEditFamily,
  onEditPlacement,
  profile,
}: {
  onEdit: () => void;
  onEditFamily: () => void;
  onEditPlacement: () => void;
  profile: Profile;
}) {
  const reviewItems = useMemo(
    () => profile.reviewFlags.map((flag) => reviewLabel(flag, profile.kind)),
    [profile.kind, profile.reviewFlags],
  );
  const eventLabel = profile.kind === "staff" ? "Joining date" : "Admission date";
  const currentPlacement = profile.placements.find((placement) => placement.isCurrent);
  const latestAcademicRecord = profile.academicRecords.find((record) => record.isLatest);
  const profilePhoto = profile.files.find((file) => file.category === "profile_photo");

  return (
    <>
      <div className="relative overflow-hidden border-b bg-[radial-gradient(circle_at_top_left,var(--color-accent),transparent_60%)] px-5 pb-7 pt-6 sm:px-8 sm:pb-9 sm:pt-8">
        <div className="flex items-center justify-between gap-3 pr-11">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            Profile
          </p>
          {profile.canEdit ? (
            <Button onClick={onEdit} variant="outline">
              <Pencil /> Edit details
            </Button>
          ) : null}
        </div>
        <div className="mt-8 flex items-start gap-4 sm:gap-5">
          {profilePhoto ? (
            <div className="aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-2xl border bg-muted shadow-sm sm:w-20">
              <img
                alt={`${profile.displayName} profile`}
                className="size-full object-cover"
                src={profilePhoto.url}
              />
            </div>
          ) : (
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl border bg-background/90 text-lg font-semibold text-primary shadow-sm sm:size-20 sm:text-xl">
              {initials(profile.displayName)}
            </div>
          )}
          <div className="min-w-0 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full capitalize" variant="outline">
                {profile.kind}
              </Badge>
              <Badge
                className="rounded-full"
                variant={profile.status === "active" ? "default" : "secondary"}
              >
                {profile.status === "active" ? "Active" : "Inactive"}
              </Badge>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
              {profile.displayName}
            </h2>
            <p className="mt-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <Fingerprint className="size-3.5" />
              {profile.identifierKind === "staff" ? "Staff" : "Admission"} ·{" "}
              {profile.primaryIdentifier}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-8 px-5 py-7 sm:px-8 sm:py-8">
          {reviewItems.length ? (
            <section className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-4 dark:bg-amber-400/10">
              <div className="flex items-start gap-3">
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Check these details</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    These details may need to be corrected.
                  </p>
                  <ul className="mt-3 space-y-1.5 text-xs text-foreground/80">
                    {reviewItems.map((item) => (
                      <li className="flex gap-2" key={item}>
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          <ProfileSection icon={UserRound} label="Identity">
            <div className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
              <ProfileField label="Full name" value={profile.displayName} />
              <ProfileField
                label={profile.identifierKind === "staff" ? "Staff number" : "Admission number"}
                mono
                value={profile.primaryIdentifier}
              />
              <ProfileField label="Person type" value={capitalize(profile.kind)} />
              <ProfileField label="Gender" value={capitalize(profile.gender ?? "unknown")} />
              <ProfileField label="Status" value={capitalize(profile.status)} />
              <ProfileField label="Nationality" value={profile.nationality} />
            </div>
          </ProfileSection>

          <Separator />

          <ProfileSection icon={CalendarDays} label="Dates">
            <div className="grid gap-4 sm:grid-cols-2">
              <SourceDate label="Date of birth" value={profile.dateOfBirth} />
              <SourceDate label={eventLabel} value={profile.admittedOrJoinedOn} />
            </div>
          </ProfileSection>

          <Separator />

          <FamilyProfileSection onEdit={onEditFamily} profile={profile} />

          <Separator />

          <PersonFilesSection profile={profile} />

          <Separator />

          <ProfileSection icon={MapPin} label="Placement">
            {profile.canEdit && profile.kind !== "staff" ? (
              <div className="mb-4 flex justify-end">
                <Button onClick={onEditPlacement} size="sm" variant="outline">
                  <Pencil /> {currentPlacement ? "Change placement" : "Add placement"}
                </Button>
              </div>
            ) : null}
            {currentPlacement ? (
              <div className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
                <div className="flex items-start gap-3.5">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Home className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{currentPlacement.homeName}</p>
                      <Badge className="rounded-full" variant="secondary">
                        Current
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[currentPlacement.locationName, currentPlacement.placementType]
                        .filter(Boolean)
                        .join(" · ") || "Home recorded"}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Since {formatDate(currentPlacement.startedOn)}
                    </p>
                    {!currentPlacement.locationName ? (
                      <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                        A home is recorded, but its location is missing.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : profile.kind === "staff" ? (
              <div className="rounded-2xl border bg-card p-4">
                <ProfileField label="Campus / work location" value={profile.campusOrLocation} />
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Placement history is not used for staff.
                </p>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-4 text-xs leading-5 text-muted-foreground">
                No placement history is available.
              </p>
            )}

            {profile.placements.length ? (
              <div className="mt-7">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <History className="size-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Placement history</h4>
                  </div>
                  <Badge className="rounded-full tabular-nums" variant="outline">
                    {profile.placements.length}
                  </Badge>
                </div>
                <ol className="relative ml-2 border-l border-border pl-5">
                  {profile.placements.map((placement) => (
                    <li className="relative pb-6 last:pb-0" key={placement.id}>
                      <span
                        className={`absolute -left-[1.59rem] top-1.5 size-2.5 rounded-full border-2 border-background ${
                          placement.isCurrent ? "bg-primary" : "bg-muted-foreground/40"
                        }`}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium tabular-nums">
                          {formatDate(placement.startedOn)}
                        </p>
                        {placement.isCurrent ? (
                          <Badge className="rounded-full px-2 py-0 text-[10px]" variant="secondary">
                            Current
                          </Badge>
                        ) : null}
                        {isFutureSourceDate(placement.startedOn) ? (
                          <Badge className="rounded-full px-2 py-0 text-[10px]" variant="outline">
                            Check date
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-sm font-semibold">{placement.homeName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[placement.locationName, placement.placementType]
                          .filter(Boolean)
                          .join(" · ") || "Location not recorded"}
                      </p>
                      {placement.endedOn ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Until {formatDate(placement.endedOn)}
                        </p>
                      ) : null}
                      {placement.reason || placement.remarks ? (
                        <div className="mt-2.5 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-5 text-foreground/80">
                          {placement.reason ? <p>{placement.reason}</p> : null}
                          {placement.remarks ? <p>{placement.remarks}</p> : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </ProfileSection>

          <Separator />

          <ProfileSection icon={GraduationCap} label="Academic history">
            {latestAcademicRecord ? (
              <div className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
                <div className="flex items-start gap-3.5">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <GraduationCap className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{latestAcademicRecord.className}</p>
                      <Badge className="rounded-full" variant="secondary">
                        Latest
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {latestAcademicRecord.schoolName || "School not recorded"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{latestAcademicRecord.academicSession}</span>
                      {latestAcademicRecord.houseName ? (
                        <span>{latestAcademicRecord.houseName} house</span>
                      ) : null}
                      <span>{formatDate(latestAcademicRecord.recordedOn)}</span>
                    </div>
                    {!latestAcademicRecord.schoolName ? (
                      <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                        The school is missing from this class record.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : profile.kind === "staff" ? (
              <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-4 text-xs leading-5 text-muted-foreground">
                School history is not used for staff.
              </p>
            ) : (
              <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-4 text-xs leading-5 text-muted-foreground">
                No school history is available.
              </p>
            )}

            {profile.academicRecords.length ? (
              <div className="mt-7">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <History className="size-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">School history</h4>
                  </div>
                  <Badge className="rounded-full tabular-nums" variant="outline">
                    {profile.academicRecords.length}
                  </Badge>
                </div>
                <ol className="relative ml-2 border-l border-border pl-5">
                  {profile.academicRecords.map((record) => (
                    <li className="relative pb-6 last:pb-0" key={record.id}>
                      <span
                        className={`absolute -left-[1.59rem] top-1.5 size-2.5 rounded-full border-2 border-background ${
                          record.isLatest ? "bg-primary" : "bg-muted-foreground/40"
                        }`}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium tabular-nums">{record.academicSession}</p>
                        {record.isLatest ? (
                          <Badge className="rounded-full px-2 py-0 text-[10px]" variant="secondary">
                            Latest
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-sm font-semibold">{record.className}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[record.schoolName, record.houseName ? `${record.houseName} house` : null]
                          .filter(Boolean)
                          .join(" · ") || "School and house not recorded"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Recorded on {formatDate(record.recordedOn)}
                      </p>
                      {record.classTitle || record.classSection ? (
                        <p className="mt-2 text-xs text-foreground/75">
                          {[record.classTitle, record.classSection].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                      {record.result || record.description ? (
                        <div className="mt-2.5 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-5 text-foreground/80">
                          {record.result ? <p>{record.result}</p> : null}
                          {record.description ? <p>{record.description}</p> : null}
                        </div>
                      ) : null}
                      {record.rollNumber || record.boardRegistrationNumber ? (
                        <div className="mt-2 grid gap-1 text-[10px] text-muted-foreground sm:grid-cols-2">
                          {record.rollNumber ? <p>Roll · {record.rollNumber}</p> : null}
                          {record.boardRegistrationNumber ? (
                            <p>Board registration · {record.boardRegistrationNumber}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </ProfileSection>
        </div>
      </div>

      <footer className="flex items-center gap-3 border-t bg-background/95 px-5 py-4 text-xs text-muted-foreground sm:px-8">
        {profile.canEdit ? (
          <>
            <Pencil className="size-4 text-primary" />
            <span className="min-w-0 flex-1">You can edit this record.</span>
            <Button className="ml-auto" onClick={onEdit}>
              Edit details
            </Button>
          </>
        ) : (
          <>
            <LockKeyhole className="size-4 text-primary" />
            <span className="min-w-0 flex-1">You do not have permission to edit this record.</span>
          </>
        )}
      </footer>
    </>
  );
}

function PersonPlacementEditor({
  onCancel,
  onSaved,
  profile,
}: {
  onCancel: () => void;
  onSaved: () => Promise<void>;
  profile: Profile;
}) {
  const current = profile.placements.find((placement) => placement.isCurrent);
  const [homeName, setHomeName] = useState(current?.homeName ?? "");
  const [locationName, setLocationName] = useState(current?.locationName ?? "");
  const [placementType, setPlacementType] = useState(current?.placementType ?? "");
  const [startedOn, setStartedOn] = useState(localDateInput());
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function savePlacement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/people/${profile.id}/placements`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          homeName,
          locationName: locationName.trim() || null,
          placementType: placementType.trim() || null,
          startedOn,
          reason: reason.trim() || null,
          remarks: remarks.trim() || null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The placement could not be saved.");
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The placement could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={savePlacement}>
      <header className="border-b bg-[radial-gradient(circle_at_top_left,var(--color-accent),transparent_65%)] px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
          Home placement
        </p>
        <h2 className="mt-5 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
          {current ? "Change home placement" : "Add home placement"}
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          {current
            ? `The current ${current.homeName} record will stay in the placement history.`
            : `Record where ${profile.displayName} currently lives.`}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
        <div className="space-y-6">
          {error ? (
            <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField className="sm:col-span-2" htmlFor="placement-home" label="Home" required>
              <Input
                autoFocus
                id="placement-home"
                maxLength={160}
                onChange={(event) => setHomeName(event.target.value)}
                required
                value={homeName}
              />
            </FormField>
            <FormField htmlFor="placement-location" label="Location">
              <Input
                id="placement-location"
                maxLength={160}
                onChange={(event) => setLocationName(event.target.value)}
                value={locationName}
              />
            </FormField>
            <FormField htmlFor="placement-type" label="Placement type">
              <Input
                id="placement-type"
                maxLength={100}
                onChange={(event) => setPlacementType(event.target.value)}
                value={placementType}
              />
            </FormField>
            <FormField htmlFor="placement-date" label="Change date" required>
              <Input
                id="placement-date"
                onChange={(event) => setStartedOn(event.target.value)}
                required
                type="date"
                value={startedOn}
              />
            </FormField>
            <FormField htmlFor="placement-reason" label="Reason">
              <Input
                id="placement-reason"
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              />
            </FormField>
            <FormField className="sm:col-span-2" htmlFor="placement-notes" label="Notes">
              <Input
                id="placement-notes"
                maxLength={1_000}
                onChange={(event) => setRemarks(event.target.value)}
                value={remarks}
              />
            </FormField>
          </div>
          <p className="rounded-xl bg-muted/50 px-4 py-3 text-xs leading-5 text-muted-foreground">
            Saving creates a new current placement. It does not delete or replace earlier records.
          </p>
        </div>
      </div>

      <footer className="flex flex-col-reverse gap-2 border-t bg-background/95 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
        <Button disabled={saving} onClick={onCancel} type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={saving} type="submit">
          {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
          {saving ? "Saving…" : "Save placement"}
        </Button>
      </footer>
    </form>
  );
}

function PersonCoreDetailsForm({
  onCancel,
  onSaved,
  profile,
}: {
  onCancel: () => void;
  onSaved: () => Promise<void>;
  profile: Profile;
}) {
  const [primaryIdentifier, setPrimaryIdentifier] = useState(profile.primaryIdentifier);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [gender, setGender] = useState(profile.gender ?? "unknown");
  const [dateOfBirth, setDateOfBirth] = useState(toDateInput(profile.dateOfBirth));
  const [admittedOrJoinedOn, setAdmittedOrJoinedOn] = useState(
    toDateInput(profile.admittedOrJoinedOn),
  );
  const [campusOrLocation, setCampusOrLocation] = useState(profile.campusOrLocation ?? "");
  const [nationality, setNationality] = useState(profile.nationality ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const eventLabel = profile.kind === "staff" ? "Joining date" : "Admission date";

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/people/${profile.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          primaryIdentifier,
          displayName,
          gender,
          dateOfBirth: dateOfBirth || null,
          admittedOrJoinedOn: admittedOrJoinedOn || null,
          campusOrLocation: campusOrLocation || null,
          nationality: nationality || null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The details could not be saved.");
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The details could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={saveDetails}>
      <div className="border-b bg-[radial-gradient(circle_at_top_left,var(--color-accent),transparent_65%)] px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
          Editable record
        </p>
        <h2 className="mt-5 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
          Edit personal details
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          Update the information used to identify this person. School placement and family details
          are changed separately.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
        <div className="space-y-8">
          {error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <fieldset className="space-y-5">
            <legend className="mb-5 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <UserRound className="size-4 text-primary" /> Identity
            </legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                className="sm:col-span-2"
                htmlFor="person-display-name"
                label="Full name"
                required
              >
                <Input
                  autoComplete="name"
                  id="person-display-name"
                  maxLength={120}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                  value={displayName}
                />
              </FormField>
              <FormField
                htmlFor="person-identifier"
                label={profile.identifierKind === "staff" ? "Staff number" : "Admission number"}
                required
              >
                <Input
                  className="font-mono"
                  id="person-identifier"
                  maxLength={50}
                  onChange={(event) => setPrimaryIdentifier(event.target.value)}
                  required
                  value={primaryIdentifier}
                />
              </FormField>
              <FormField htmlFor="person-gender" label="Gender">
                <Select onValueChange={(value) => setGender(value as typeof gender)} value={gender}>
                  <SelectTrigger className="w-full" id="person-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="unknown">Not recorded</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </fieldset>

          <Separator />

          <fieldset className="space-y-5">
            <legend className="mb-5 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <CalendarDays className="size-4 text-primary" /> Dates and location
            </legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField htmlFor="person-date-of-birth" label="Date of birth">
                <Input
                  id="person-date-of-birth"
                  onChange={(event) => setDateOfBirth(event.target.value)}
                  type="date"
                  value={dateOfBirth}
                />
              </FormField>
              <FormField htmlFor="person-event-date" label={eventLabel}>
                <Input
                  id="person-event-date"
                  onChange={(event) => setAdmittedOrJoinedOn(event.target.value)}
                  type="date"
                  value={admittedOrJoinedOn}
                />
              </FormField>
              <FormField htmlFor="person-campus" label="Campus or location">
                <Input
                  id="person-campus"
                  maxLength={160}
                  onChange={(event) => setCampusOrLocation(event.target.value)}
                  value={campusOrLocation}
                />
              </FormField>
              <FormField htmlFor="person-nationality" label="Nationality">
                <Input
                  id="person-nationality"
                  maxLength={100}
                  onChange={(event) => setNationality(event.target.value)}
                  value={nationality}
                />
              </FormField>
            </div>
          </fieldset>

          <p className="rounded-xl bg-muted/50 px-4 py-3 text-xs leading-5 text-muted-foreground">
            Person type and active status are managed by admission, transfer, withdrawal, and
            completion actions.
          </p>
        </div>
      </div>

      <footer className="flex flex-col-reverse gap-2 border-t bg-background/95 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
        <Button disabled={saving} onClick={onCancel} type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={saving} type="submit">
          {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
          {saving ? "Saving…" : "Save details"}
        </Button>
      </footer>
    </form>
  );
}

function FormField({
  children,
  className,
  htmlFor,
  label,
  required = false,
}: {
  children: React.ReactNode;
  className?: string;
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className={className}>
      <Label className="mb-2" htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function PersonFilesSection({ profile }: { profile: Profile }) {
  const relatedImages = profile.files.filter(
    (file) => file.category !== "profile_photo" && file.category !== "document",
  );
  const documents = profile.files.filter((file) => file.category === "document");

  return (
    <ProfileSection icon={FileText} label="Media & documents">
      {!profile.files.length ? (
        <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-4 text-xs leading-5 text-muted-foreground">
          No photos or documents are available.
        </p>
      ) : (
        <div className="space-y-7">
          {relatedImages.length ? (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">Related photos</h4>
                <Badge className="rounded-full tabular-nums" variant="outline">
                  {relatedImages.length}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {relatedImages.map((file) => (
                  <a
                    className="group overflow-hidden rounded-2xl border bg-card shadow-xs transition-colors hover:border-primary/35"
                    href={file.url}
                    key={file.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-muted/60">
                      <img
                        alt={file.label}
                        className="size-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                        loading="lazy"
                        src={file.url}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <p className="truncate text-xs font-medium">{file.label}</p>
                      <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {documents.length ? (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">Documents</h4>
                <Badge className="rounded-full tabular-nums" variant="outline">
                  {documents.length}
                </Badge>
              </div>
              <div className="overflow-hidden rounded-2xl border bg-card">
                {documents.map((file, index) => (
                  <a
                    className={`flex min-h-16 items-center gap-3 px-3.5 py-3 transition-colors hover:bg-muted/45 sm:px-4 ${index ? "border-t" : ""}`}
                    href={file.url}
                    key={file.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{file.label}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {file.contentType} · {formatBytes(file.byteSize)}
                      </p>
                    </div>
                    <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </ProfileSection>
  );
}

function FamilyProfileSection({ onEdit, profile }: { onEdit: () => void; profile: Profile }) {
  const family = profile.family;
  const guardians = family
    ? [
        {
          label: "Primary guardian",
          name: family.guardian1Name,
          address: family.guardian1Address,
          email: family.guardian1Email,
          phone: family.guardian1Mobile || family.guardian1Phone,
          alternatePhone: family.guardian1Mobile ? family.guardian1Phone : null,
        },
        {
          label: "Secondary guardian",
          name: family.guardian2Name,
          address: family.guardian2Address,
          email: family.guardian2Email,
          phone: family.guardian2Mobile || family.guardian2Phone,
          alternatePhone: family.guardian2Mobile ? family.guardian2Phone : null,
        },
      ].filter((guardian) =>
        [guardian.name, guardian.address, guardian.email, guardian.phone].some(Boolean),
      )
    : [];
  const hasParents = Boolean(
    family &&
    [family.motherName, family.fatherName, family.motherOccupation, family.fatherOccupation].some(
      Boolean,
    ),
  );
  const hasHouseholdContext = Boolean(
    family &&
    [family.parentageStatus, family.maritalStatus, family.spouseName, family.numberOfChildren].some(
      Boolean,
    ),
  );

  return (
    <ProfileSection
      action={
        profile.canEdit ? (
          <Button onClick={onEdit} size="sm" variant="outline">
            <Pencil /> Edit family
          </Button>
        ) : null
      }
      icon={UsersRound}
      label="Family & relationships"
    >
      {!family && !profile.relationships.length ? (
        <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-4 text-xs leading-5 text-muted-foreground">
          {profile.kind === "staff"
            ? "Family details are not available for staff."
            : "No family or sibling details are available."}
        </p>
      ) : (
        <div className="space-y-6">
          {hasHouseholdContext ? (
            <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-xs sm:grid-cols-2 sm:p-5">
              <ProfileField label="Parents' status" value={family?.parentageStatus ?? null} />
              <ProfileField label="Marital status" value={family?.maritalStatus ?? null} />
              <ProfileField label="Spouse" value={family?.spouseName ?? null} />
              <ProfileField label="Number of children" value={family?.numberOfChildren ?? null} />
            </div>
          ) : null}

          {hasParents ? (
            <div>
              <h4 className="mb-3 text-sm font-semibold">Parents</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <FamilyPersonCard
                  label="Mother"
                  name={family?.motherName ?? null}
                  supportingValue={family?.motherOccupation ?? null}
                />
                <FamilyPersonCard
                  label="Father"
                  name={family?.fatherName ?? null}
                  supportingValue={family?.fatherOccupation ?? null}
                />
              </div>
              {family?.parentsPhone || family?.parentsPermanentAddress ? (
                <div className="mt-3 space-y-2 rounded-xl bg-muted/45 px-4 py-3">
                  <ContactLine icon={Phone} label="Family phone" value={family.parentsPhone} />
                  <ContactLine
                    icon={MapPinned}
                    label="Permanent address"
                    value={family.parentsPermanentAddress}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {guardians.length ? (
            <div>
              <h4 className="mb-3 text-sm font-semibold">Guardians</h4>
              <div className="space-y-3">
                {guardians.map((guardian) => (
                  <div className="rounded-2xl border bg-card p-4" key={guardian.label}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {guardian.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {guardian.name || "Name not recorded"}
                    </p>
                    <div className="mt-3 space-y-2">
                      <ContactLine icon={Phone} label="Phone" value={guardian.phone} />
                      <ContactLine
                        icon={Phone}
                        label="Alternate phone"
                        value={guardian.alternatePhone}
                      />
                      <ContactLine icon={Mail} label="Email" value={guardian.email} />
                      <ContactLine icon={MapPinned} label="Address" value={guardian.address} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {profile.relationships.length ? (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold">Siblings</h4>
                <Badge className="rounded-full tabular-nums" variant="outline">
                  {profile.relationships.length}
                </Badge>
              </div>
              <div className="overflow-hidden rounded-2xl border bg-card">
                {profile.relationships.map((relationship, index) => (
                  <div
                    className={`flex items-center gap-3 px-4 py-3.5 ${index ? "border-t" : ""}`}
                    key={relationship.id}
                  >
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-xs font-semibold text-primary">
                      {initials(relationship.displayName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{relationship.displayName}</p>
                        {relationship.reviewFlag ? (
                          <Badge className="rounded-full px-2 py-0 text-[10px]" variant="outline">
                            Check link
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {relationship.identifierKind === "staff" ? "Staff" : "Admission"} ·{" "}
                        {relationship.primaryIdentifier}
                      </p>
                    </div>
                    <Badge className="shrink-0 rounded-full capitalize" variant="secondary">
                      {relationship.status}
                    </Badge>
                  </div>
                ))}
              </div>
              {profile.relationships.some((relationship) => relationship.reviewFlag) ? (
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Some sibling links may be duplicated or point back to the same person.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </ProfileSection>
  );
}

function FamilyPersonCard({
  label,
  name,
  supportingValue,
}: {
  label: string;
  name: string | null;
  supportingValue: string | null;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <HeartHandshake className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-sm font-semibold">{name || "Name not recorded"}</p>
          {supportingValue ? (
            <p className="mt-1 text-xs text-muted-foreground">{supportingValue}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ContactLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-xs leading-5 text-foreground/80">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <span className="sr-only">{label}: </span>
      <span className="break-words">{value}</span>
    </div>
  );
}

function ProfileSection({
  action,
  children,
  icon: Icon,
  label,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  icon: typeof UserRound;
  label: string;
}) {
  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Icon className="size-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ProfileField({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string | null;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1.5 text-sm ${mono ? "font-mono text-xs" : "font-medium"}`}>
        {value || <span className="font-normal text-muted-foreground/70">Not recorded</span>}
      </p>
    </div>
  );
}

function SourceDate({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold">{value ? formatDate(value) : "Not recorded"}</p>
    </div>
  );
}

function reviewLabel(flag: string, kind: Profile["kind"]): string {
  if (flag === "date_of_birth_missing") return "Date of birth is not recorded.";
  if (flag === "event_date_missing") {
    return kind === "staff" ? "Joining date is not recorded." : "Admission date is not recorded.";
  }
  if (flag === "event_date_before_1900") {
    return kind === "staff"
      ? "Joining date is earlier than 1900."
      : "Admission date is earlier than 1900.";
  }
  if (flag === "event_before_birth") {
    return kind === "staff"
      ? "Joining date is earlier than date of birth."
      : "Admission date is earlier than date of birth.";
  }
  return "This date needs to be checked.";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function toDateInput(value: string | null): string {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

function localDateInput(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

async function readPersonProfile(personId: string, signal?: AbortSignal): Promise<Profile> {
  const response = await fetch(`/api/people/${personId}`, { signal });
  const payload = (await response.json()) as { error?: string; person?: Profile };
  if (!response.ok || !payload.person) {
    throw new Error(payload.error ?? "This profile could not be loaded.");
  }
  return payload.person;
}

function isFutureSourceDate(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}
