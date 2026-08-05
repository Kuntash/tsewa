import {
  AlertTriangle,
  CalendarDays,
  Database,
  Fingerprint,
  GraduationCap,
  HeartHandshake,
  History,
  Home,
  ImageOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MapPinned,
  MapPin,
  Phone,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

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
  reviewFlags: string[];
  placements: Array<{
    id: string;
    homeName: string;
    locationName: string | null;
    placementType: string | null;
    startedOn: string;
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
  family: {
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
  } | null;
  relationships: Array<{
    id: string;
    relationshipType: "sibling";
    reviewFlag: "self_reference" | "duplicate_source_link" | null;
    personId: string;
    displayName: string;
    primaryIdentifier: string;
    identifierKind: "admission" | "staff";
    kind: "child" | "elderly" | "staff";
    status: "active" | "inactive";
  }>;
};

export function PersonProfileSheet({
  onOpenChange,
  personId,
}: {
  onOpenChange: (open: boolean) => void;
  personId: string | null;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!personId) {
      setProfile(null);
      setError("");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(`/api/people/${personId}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as { error?: string; person?: Profile };
        if (!response.ok || !payload.person) {
          throw new Error(payload.error ?? "This profile could not be loaded.");
        }
        return payload.person;
      })
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
        <SheetDescription className="sr-only">
          Read-only identity and migration record.
        </SheetDescription>

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
        ) : profile ? (
          <ProfileContent profile={profile} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ProfileContent({ profile }: { profile: Profile }) {
  const reviewItems = useMemo(
    () => profile.reviewFlags.map((flag) => reviewLabel(flag, profile.kind)),
    [profile.kind, profile.reviewFlags],
  );
  const eventLabel = profile.kind === "staff" ? "Joining date" : "Admission date";
  const currentPlacement = profile.placements.find((placement) => placement.isCurrent);
  const latestAcademicRecord = profile.academicRecords.find((record) => record.isLatest);

  return (
    <>
      <div className="relative overflow-hidden border-b bg-[radial-gradient(circle_at_top_left,var(--color-accent),transparent_60%)] px-5 pb-7 pt-6 sm:px-8 sm:pb-9 sm:pt-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
          Longitudinal record · Overview
        </p>
        <div className="mt-8 flex items-start gap-4 sm:gap-5">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl border bg-background/90 text-lg font-semibold text-primary shadow-sm sm:size-20 sm:text-xl">
            {initials(profile.displayName)}
          </div>
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
                  <h3 className="text-sm font-semibold">Review suggested</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    The legacy values are shown unchanged and remain authoritative until the
                    organization corrects them.
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

          <FamilyProfileSection profile={profile} />

          <Separator />

          <ProfileSection icon={MapPin} label="Placement">
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
                        .join(" · ") || "Legacy home record"}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Since {formatLegacyDate(currentPlacement.startedOn)}
                    </p>
                    {!currentPlacement.locationName ? (
                      <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                        The legacy home is recorded, but its location lookup is unavailable.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : profile.kind === "staff" ? (
              <div className="rounded-2xl border bg-card p-4">
                <ProfileField label="Campus / work location" value={profile.campusOrLocation} />
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Beneficiary placement history does not apply to staff records.
                </p>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-4 text-xs leading-5 text-muted-foreground">
                No placement history was recorded for this person in the legacy system.
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
                          {formatLegacyDate(placement.startedOn)}
                        </p>
                        {placement.isCurrent ? (
                          <Badge className="rounded-full px-2 py-0 text-[10px]" variant="secondary">
                            Current
                          </Badge>
                        ) : null}
                        {isFutureSourceDate(placement.startedOn) ? (
                          <Badge className="rounded-full px-2 py-0 text-[10px]" variant="outline">
                            Future source date
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-sm font-semibold">{placement.homeName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[placement.locationName, placement.placementType]
                          .filter(Boolean)
                          .join(" · ") || "Location not recorded"}
                      </p>
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

            <div className="mt-6">
              <ProfileField
                label="Photo reference"
                value={profile.photoReferencePresent ? "Available in legacy source" : null}
              />
            </div>
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
                      <span>{formatLegacyDate(latestAcademicRecord.recordedOn)}</span>
                    </div>
                    {!latestAcademicRecord.schoolName ? (
                      <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                        The class record is intact, but its legacy school lookup is unavailable.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : profile.kind === "staff" ? (
              <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-4 text-xs leading-5 text-muted-foreground">
                Beneficiary academic history does not apply to staff records.
              </p>
            ) : (
              <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-4 text-xs leading-5 text-muted-foreground">
                No academic history was recorded for this person in the legacy system.
              </p>
            )}

            {profile.academicRecords.length ? (
              <div className="mt-7">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <History className="size-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Academic timeline</h4>
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
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        Source date · {record.recordedOn}
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

          <Separator />

          <ProfileSection icon={Database} label="Migration provenance">
            <div className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
              <ProfileField label="Source system" value={profile.sourceSystem} />
              <ProfileField label="Legacy table" mono value={profile.sourceTable} />
              <ProfileField label="Legacy record ID" mono value={profile.sourceId} />
              <ProfileField label="Imported on" value={formatTimestamp(profile.importedAt)} />
            </div>
          </ProfileSection>

          {!profile.photoReferencePresent ? (
            <div className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground">
              <ImageOff className="size-4 shrink-0" />
              No photo reference is present in the legacy record.
            </div>
          ) : null}
        </div>
      </div>

      <footer className="flex items-center gap-3 border-t bg-background/95 px-5 py-4 text-xs text-muted-foreground sm:px-8">
        <LockKeyhole className="size-4 text-primary" />
        Read-only profile · Source values cannot be edited in this slice
      </footer>
    </>
  );
}

function FamilyProfileSection({ profile }: { profile: Profile }) {
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
    <ProfileSection icon={UsersRound} label="Family & relationships">
      {!family && !profile.relationships.length ? (
        <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-4 text-xs leading-5 text-muted-foreground">
          {profile.kind === "staff"
            ? "Family details are not part of the current staff migration slice."
            : "No family or sibling relationships were recorded in the legacy system."}
        </p>
      ) : (
        <div className="space-y-6">
          {hasHouseholdContext ? (
            <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-xs sm:grid-cols-2 sm:p-5">
              <ProfileField label="Parentage" value={family?.parentageStatus ?? null} />
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
                            Review source link
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
                  Review badges preserve self-references or duplicate links exactly as recorded in
                  the legacy source.
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
  children,
  icon: Icon,
  label,
}: {
  children: React.ReactNode;
  icon: typeof UserRound;
  label: string;
}) {
  return (
    <section>
      <div className="mb-5 flex items-center gap-2.5">
        <Icon className="size-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </h3>
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
      <p className="mt-2 text-base font-semibold">
        {value ? formatLegacyDate(value) : "Not recorded"}
      </p>
      {value ? (
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">Source value · {value}</p>
      ) : null}
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
  return "A legacy date value requires review.";
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

function formatLegacyDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isFutureSourceDate(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}
