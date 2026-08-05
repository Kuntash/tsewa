import {
  AlertTriangle,
  CalendarDays,
  Database,
  Fingerprint,
  ImageOff,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  UserRound,
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

          <ProfileSection icon={MapPin} label="Placement">
            <div className="grid gap-x-7 gap-y-5 sm:grid-cols-2">
              <ProfileField label="Campus / location" value={profile.campusOrLocation} />
              <ProfileField
                label="Photo reference"
                value={profile.photoReferencePresent ? "Available in legacy source" : null}
              />
            </div>
            {!profile.campusOrLocation ? (
              <p className="mt-4 rounded-xl bg-muted/60 px-3.5 py-3 text-xs leading-5 text-muted-foreground">
                Placement will be derived from home and academic history in the next migration
                slices.
              </p>
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
