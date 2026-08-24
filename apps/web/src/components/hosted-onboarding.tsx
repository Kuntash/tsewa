import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  GraduationCap,
  ImagePlus,
  LoaderCircle,
  MailPlus,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
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
import { cn } from "@/lib/utils";

type ClassRow = { id: string; name: string; section: string };
type InvitationRow = { id: string; email: string; group: "admin" | "staff" | "viewer" };

const steps = [
  { eyebrow: "Identity", title: "Your institution", Icon: Building2 },
  { eyebrow: "Calendar", title: "Academic year", Icon: CalendarDays },
  { eyebrow: "Structure", title: "First school", Icon: GraduationCap },
  { eyebrow: "Access", title: "Invite your team", Icon: Users },
] as const;

const classPresets = [
  { label: "Early years", names: ["Nursery", "Lower kindergarten", "Upper kindergarten"] },
  { label: "Primary", names: ["Class I", "Class II", "Class III", "Class IV", "Class V"] },
  { label: "Middle", names: ["Class VI", "Class VII", "Class VIII"] },
  { label: "Secondary", names: ["Class IX", "Class X"] },
  { label: "Senior secondary", names: ["Class XI", "Class XII"] },
] as const;

const localeOptions = [
  { value: "en-IN", label: "English (India)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-US", label: "English (United States)" },
  { value: "bo-CN", label: "Tibetan" },
  { value: "hi-IN", label: "Hindi" },
] as const;

const timezoneOptions = [
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Thimphu",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
] as const;

export function HostedOnboarding({ ownerName }: { ownerName: string }) {
  const year = new Date().getUTCFullYear();
  const [step, setStep] = useState(0);
  const [organizationName, setOrganizationName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [displayTitle, setDisplayTitle] = useState("");
  const [locale, setLocale] = useState("en-IN");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [sessionName, setSessionName] = useState(String(year));
  const [startsOn, setStartsOn] = useState(`${year}-01-01`);
  const [endsOn, setEndsOn] = useState(`${year}-12-31`);
  const [schoolName, setSchoolName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [affiliationNumber, setAffiliationNumber] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!logo) {
      setLogoPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(logo);
    setLogoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logo]);

  const canContinue = useMemo(() => {
    if (step === 0) {
      return (
        organizationName.trim().length >= 2 && /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/.test(slug)
      );
    }
    if (step === 1) return sessionName.trim().length >= 2 && startsOn < endsOn;
    if (step === 2) {
      return (
        schoolName.trim().length >= 2 &&
        classes.length > 0 &&
        classes.every((item) => item.name.trim().length > 0)
      );
    }
    return invitations.every((item) => /^\S+@\S+\.\S+$/.test(item.email));
  }, [
    classes,
    endsOn,
    invitations,
    organizationName,
    schoolName,
    sessionName,
    slug,
    startsOn,
    step,
  ]);

  function updateOrganizationName(value: string) {
    setOrganizationName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  function addPreset(names: readonly string[]) {
    setClasses((current) => {
      const existing = new Set(current.map((item) => item.name.trim().toLowerCase()));
      return [
        ...current,
        ...names
          .filter((name) => !existing.has(name.toLowerCase()))
          .map((name) => ({ id: crypto.randomUUID(), name, section: "" })),
      ];
    });
  }

  function addClass() {
    setClasses((current) => [...current, { id: crypto.randomUUID(), name: "", section: "" }]);
  }

  function addInvitation() {
    setInvitations((current) => [
      ...current,
      { id: crypto.randomUUID(), email: "", group: "admin" },
    ]);
  }

  async function finish() {
    if (!canContinue || submitting) return;
    setSubmitting(true);
    setError("");
    setWarnings([]);

    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organization: {
          name: organizationName,
          slug,
          displayTitle: displayTitle || null,
          timezone,
          locale,
        },
        session: { name: sessionName, startsOn, endsOn },
        school: {
          name: schoolName,
          locationName: locationName || null,
          affiliationNumber: affiliationNumber || null,
        },
        classes: classes.map(({ name, section }) => ({ name, section: section || null })),
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Your organization could not be created.");
      setSubmitting(false);
      return;
    }

    const nextWarnings: string[] = [];
    if (logo) {
      const logoBody = new FormData();
      logoBody.set("file", logo);
      const logoResponse = await fetch("/api/organization/logo", {
        method: "POST",
        body: logoBody,
      });
      if (!logoResponse.ok)
        nextWarnings.push("The workspace was created, but the logo did not upload.");
    }

    for (const invitation of invitations) {
      const invitationResponse = await fetch("/api/organization/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: invitation.email, group: invitation.group }),
      });
      if (!invitationResponse.ok) {
        nextWarnings.push(`The invitation to ${invitation.email} could not be sent.`);
      }
    }

    setWarnings(nextWarnings);
    setSubmitting(false);
    if (nextWarnings.length) setComplete(true);
    else window.location.assign("/dashboard");
  }

  if (complete) {
    return (
      <main className="grid min-h-svh place-items-center bg-[#f1eee5] px-5 py-12 text-[#17372d] dark:bg-background dark:text-foreground">
        <section className="w-full max-w-xl rounded-[2rem] border border-[#17372d]/15 bg-[#fffdf8] p-8 shadow-[0_32px_90px_-45px_rgba(17,55,44,.45)] dark:border-border dark:bg-card sm:p-11">
          <div className="grid size-12 place-items-center rounded-full bg-[#dce9d7] text-[#225c46] dark:bg-primary/15 dark:text-primary">
            <Check className="size-5" />
          </div>
          <p className="mt-8 text-xs font-semibold tracking-[0.18em] text-[#b36b3f] uppercase">
            Workspace ready
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-editorial)] text-4xl leading-none font-medium tracking-[-0.035em] sm:text-5xl">
            {organizationName} has a place to begin.
          </h1>
          <p className="mt-5 leading-7 text-[#557067] dark:text-muted-foreground">
            Your owner access, academic year, school, and classes are ready. A few optional items
            need attention in settings.
          </p>
          <div className="mt-6 space-y-2">
            {warnings.map((warning) => (
              <p
                className="rounded-xl border border-amber-700/20 bg-amber-100/60 px-4 py-3 text-sm text-amber-950 dark:bg-amber-400/10 dark:text-amber-100"
                key={warning}
              >
                {warning}
              </p>
            ))}
          </div>
          <Button
            className="mt-8 h-11 rounded-full px-6"
            onClick={() => window.location.assign("/dashboard")}
          >
            Open your workspace <ArrowRight />
          </Button>
        </section>
      </main>
    );
  }

  const current = steps[step];
  const CurrentIcon = current.Icon;

  return (
    <main className="min-h-svh bg-[#123b2f] lg:grid lg:grid-cols-[minmax(300px,0.72fr)_minmax(620px,1.65fr)]">
      <aside className="relative overflow-hidden bg-[#123b2f] px-6 py-7 text-[#f6f0e3] lg:flex lg:min-h-svh lg:flex-col lg:px-10 lg:py-10">
        <div className="pointer-events-none absolute -top-44 -left-32 size-[28rem] rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -top-24 -left-16 size-[19rem] rounded-full border border-white/10" />
        <div className="relative flex items-center justify-between">
          <a className="flex items-center gap-3" href="/">
            <span className="grid size-10 place-items-center rounded-xl border border-white/15 bg-white/10 font-[family-name:var(--font-editorial)] text-xl italic">
              T
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[0.08em]">TSEWA</span>
              <span className="block text-[11px] text-[#a9c4b6]">Organization setup</span>
            </span>
          </a>
          <div className="lg:hidden">
            <ThemeToggle />
          </div>
        </div>

        <div className="relative mt-10 lg:mt-auto lg:mb-auto">
          <p className="text-xs font-semibold tracking-[0.18em] text-[#d89a70] uppercase">
            Welcome, {ownerName.split(" ")[0]}
          </p>
          <h1 className="mt-4 max-w-sm font-[family-name:var(--font-editorial)] text-4xl leading-[0.98] font-medium tracking-[-0.035em] lg:text-5xl">
            Set the first lines of your institution’s record.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-6 text-[#a9c4b6]">
            Four considered steps. Everything can be refined later from organization and school
            settings.
          </p>

          <ol className="mt-9 grid grid-cols-4 gap-2 lg:grid-cols-1 lg:gap-1">
            {steps.map((item, index) => {
              const Icon = item.Icon;
              const active = index === step;
              const done = index < step;
              return (
                <li key={item.title}>
                  <button
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                      active ? "border-white/15 bg-white/10" : "border-transparent",
                      index <= step ? "text-[#f6f0e3]" : "text-[#729385]",
                    )}
                    disabled={index > step}
                    onClick={() => index < step && setStep(index)}
                    type="button"
                  >
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-full border",
                        done
                          ? "border-[#d89a70] bg-[#d89a70] text-[#123b2f]"
                          : active
                            ? "border-white/30 bg-white/10"
                            : "border-white/10",
                      )}
                    >
                      {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                    </span>
                    <span className="hidden lg:block">
                      <span className="block text-[10px] font-semibold tracking-[0.16em] text-[#7fa092] uppercase">
                        {item.eyebrow}
                      </span>
                      <span className="mt-0.5 block text-sm">{item.title}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="relative mt-7 hidden text-xs leading-5 text-[#729385] lg:block">
          Your data is separated by organization from the first record onward.
        </p>
      </aside>

      <section className="relative min-h-[calc(100svh-7rem)] overflow-hidden rounded-t-[2rem] bg-[#f1eee5] text-[#17372d] dark:bg-background dark:text-foreground lg:min-h-svh lg:rounded-none">
        <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(31,67,55,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(31,67,55,.045)_1px,transparent_1px)] [background-size:48px_48px] dark:opacity-10" />
        <div className="relative mx-auto flex min-h-full w-full max-w-4xl flex-col px-5 py-7 sm:px-10 lg:min-h-svh lg:px-14 lg:py-10 xl:px-20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-[0.16em] text-[#8a7463] uppercase">
              Step {step + 1} of {steps.length}
            </p>
            <div className="hidden lg:block">
              <ThemeToggle />
            </div>
          </div>

          <div className="my-auto py-10 lg:py-14">
            <div className="flex items-center gap-3 text-[#b36b3f]">
              <CurrentIcon className="size-5" />
              <span className="text-xs font-semibold tracking-[0.18em] uppercase">
                {current.eyebrow}
              </span>
            </div>
            <h2 className="mt-4 max-w-2xl font-[family-name:var(--font-editorial)] text-4xl leading-[0.98] font-medium tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              {step === 0
                ? "Begin with the name people already trust."
                : step === 1
                  ? "Place the work inside the right year."
                  : step === 2
                    ? "Sketch the school as it operates today."
                    : "Bring in the people who will run it with you."}
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-[#64786f] dark:text-muted-foreground">
              {step === 0
                ? "This identity appears throughout the workspace and on formal records."
                : step === 1
                  ? "Dates drive rosters, placements, results, and the session switcher."
                  : step === 2
                    ? "Start with one school and its active classes. Add more schools, houses, or specialist classes later."
                    : "Invitations are optional. Each person receives a private, expiring email link."}
            </p>

            <div className="mt-9">
              {step === 0 ? (
                <InstitutionStep
                  displayTitle={displayTitle}
                  logoPreview={logoPreview}
                  organizationName={organizationName}
                  setDisplayTitle={setDisplayTitle}
                  setLogo={setLogo}
                  setOrganizationName={updateOrganizationName}
                  setSlug={(value) => {
                    setSlugEdited(true);
                    setSlug(slugify(value));
                  }}
                  slug={slug}
                />
              ) : step === 1 ? (
                <CalendarStep
                  endsOn={endsOn}
                  locale={locale}
                  sessionName={sessionName}
                  setEndsOn={setEndsOn}
                  setLocale={setLocale}
                  setSessionName={setSessionName}
                  setStartsOn={setStartsOn}
                  setTimezone={setTimezone}
                  startsOn={startsOn}
                  timezone={timezone}
                  year={year}
                />
              ) : step === 2 ? (
                <SchoolStep
                  addClass={addClass}
                  addPreset={addPreset}
                  affiliationNumber={affiliationNumber}
                  classes={classes}
                  locationName={locationName}
                  schoolName={schoolName}
                  setAffiliationNumber={setAffiliationNumber}
                  setClasses={setClasses}
                  setLocationName={setLocationName}
                  setSchoolName={setSchoolName}
                />
              ) : (
                <TeamStep
                  addInvitation={addInvitation}
                  classes={classes}
                  invitations={invitations}
                  organizationName={organizationName}
                  schoolName={schoolName}
                  sessionName={sessionName}
                  setInvitations={setInvitations}
                />
              )}
            </div>

            {error ? (
              <p className="mt-6 rounded-xl border border-red-900/15 bg-red-100/60 px-4 py-3 text-sm text-red-900 dark:bg-destructive/10 dark:text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-[#17372d]/12 pt-5 dark:border-border">
            <Button
              className="h-10 rounded-full px-4"
              disabled={step === 0 || submitting}
              onClick={() => {
                setError("");
                setStep((value) => value - 1);
              }}
              variant="ghost"
            >
              <ArrowLeft /> Back
            </Button>
            {step < steps.length - 1 ? (
              <Button
                className="h-10 rounded-full px-5"
                disabled={!canContinue}
                onClick={() => {
                  setError("");
                  setStep((value) => value + 1);
                }}
              >
                Continue <ArrowRight />
              </Button>
            ) : (
              <Button
                className="h-10 rounded-full px-5"
                disabled={!canContinue || submitting}
                onClick={() => void finish()}
              >
                {submitting ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                {submitting ? "Preparing workspace" : "Create workspace"}
              </Button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function InstitutionStep({
  organizationName,
  setOrganizationName,
  slug,
  setSlug,
  displayTitle,
  setDisplayTitle,
  logoPreview,
  setLogo,
}: {
  organizationName: string;
  setOrganizationName: (value: string) => void;
  slug: string;
  setSlug: (value: string) => void;
  displayTitle: string;
  setDisplayTitle: (value: string) => void;
  logoPreview: string;
  setLogo: (file: File | null) => void;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_180px]">
      <div className="space-y-5">
        <Field label="Organization name" hint="The legal or commonly used institution name.">
          <Input
            autoComplete="organization"
            className="h-11 rounded-xl bg-white/70 px-4 text-sm dark:bg-input/20"
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder="Norling Education Trust"
            value={organizationName}
          />
        </Field>
        <Field label="Workspace address" hint={`Your private address on app.gettsewa.com.`}>
          <div className="flex h-11 overflow-hidden rounded-xl border border-input bg-white/70 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 dark:bg-input/20">
            <Input
              className="h-full flex-1 rounded-none border-0 bg-transparent px-4 shadow-none focus-visible:ring-0"
              onChange={(event) => setSlug(event.target.value)}
              placeholder="norling"
              value={slug}
            />
            <span className="flex items-center border-l border-input px-3 text-xs text-muted-foreground">
              .gettsewa
            </span>
          </div>
        </Field>
        <Field
          label="Workspace title"
          hint="Optional. A shorter operational title shown beside your logo."
        >
          <Input
            className="h-11 rounded-xl bg-white/70 px-4 text-sm dark:bg-input/20"
            onChange={(event) => setDisplayTitle(event.target.value)}
            placeholder="School & Care Operations"
            value={displayTitle}
          />
        </Field>
      </div>
      <div>
        <Label>Organization mark</Label>
        <label className="mt-2 grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-[1.5rem] border border-dashed border-[#17372d]/25 bg-white/55 text-center transition-colors hover:bg-white dark:border-border dark:bg-input/10 dark:hover:bg-input/20">
          {logoPreview ? (
            <img
              alt="Organization logo preview"
              className="size-full object-contain p-4"
              src={logoPreview}
            />
          ) : (
            <span className="flex flex-col items-center gap-3 px-4 text-xs leading-5 text-muted-foreground">
              <ImagePlus className="size-6 text-[#b36b3f]" /> PNG, JPEG or WebP
              <br />
              up to 2 MB
            </span>
          )}
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => setLogo(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
      </div>
    </div>
  );
}

function CalendarStep({
  sessionName,
  setSessionName,
  startsOn,
  setStartsOn,
  endsOn,
  setEndsOn,
  locale,
  setLocale,
  timezone,
  setTimezone,
  year,
}: {
  sessionName: string;
  setSessionName: (value: string) => void;
  startsOn: string;
  setStartsOn: (value: string) => void;
  endsOn: string;
  setEndsOn: (value: string) => void;
  locale: string;
  setLocale: (value: string) => void;
  timezone: string;
  setTimezone: (value: string) => void;
  year: number;
}) {
  const calendarStart = new Date(year - 2, 0);
  const calendarEnd = new Date(year + 4, 11);
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Academic session name" hint="For example 2026 or 2026–27.">
        <Input
          className="h-11 rounded-xl bg-white/70 px-4 text-sm dark:bg-input/20"
          onChange={(event) => setSessionName(event.target.value)}
          value={sessionName}
        />
      </Field>
      <Field label="Regional format" hint="Used for dates and numbers.">
        <Select onValueChange={setLocale} value={locale}>
          <SelectTrigger className="h-11 w-full rounded-xl bg-white/70 px-4 text-sm dark:bg-input/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {localeOptions.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <DatePickerField
        endMonth={calendarEnd}
        label="Starts on"
        name="startsOn"
        onChange={setStartsOn}
        required
        startMonth={calendarStart}
        value={startsOn}
      />
      <DatePickerField
        endMonth={calendarEnd}
        label="Ends on"
        name="endsOn"
        onChange={setEndsOn}
        required
        startMonth={calendarStart}
        value={endsOn}
      />
      <div className="sm:col-span-2">
        <Field label="Time zone" hint="Controls record times, reports, and deadlines.">
          <Select onValueChange={setTimezone} value={timezone}>
            <SelectTrigger className="h-11 w-full rounded-xl bg-white/70 px-4 text-sm dark:bg-input/20">
              <MapPin className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timezoneOptions.map((item) => (
                <SelectItem key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

function SchoolStep({
  schoolName,
  setSchoolName,
  locationName,
  setLocationName,
  affiliationNumber,
  setAffiliationNumber,
  classes,
  setClasses,
  addClass,
  addPreset,
}: {
  schoolName: string;
  setSchoolName: (value: string) => void;
  locationName: string;
  setLocationName: (value: string) => void;
  affiliationNumber: string;
  setAffiliationNumber: (value: string) => void;
  classes: ClassRow[];
  setClasses: Dispatch<SetStateAction<ClassRow[]>>;
  addClass: () => void;
  addPreset: (names: readonly string[]) => void;
}) {
  return (
    <div className="space-y-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="School name" hint="The first active school or campus.">
            <Input
              className="h-11 rounded-xl bg-white/70 px-4 text-sm dark:bg-input/20"
              onChange={(event) => setSchoolName(event.target.value)}
              placeholder="Norling Senior School"
              value={schoolName}
            />
          </Field>
        </div>
        <Field label="Location" hint="Optional campus or town.">
          <Input
            className="h-11 rounded-xl bg-white/70 px-4 text-sm dark:bg-input/20"
            onChange={(event) => setLocationName(event.target.value)}
            placeholder="Dharamshala"
            value={locationName}
          />
        </Field>
        <Field label="Affiliation number" hint="Optional board reference.">
          <Input
            className="h-11 rounded-xl bg-white/70 px-4 text-sm dark:bg-input/20"
            onChange={(event) => setAffiliationNumber(event.target.value)}
            placeholder="CBSE / State board"
            value={affiliationNumber}
          />
        </Field>
      </div>
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Label>Active classes</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Use a stage set, then rename or add sections as needed.
            </p>
          </div>
          <Button className="w-fit rounded-full" onClick={addClass} type="button" variant="outline">
            <Plus /> Add one
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {classPresets.map((preset) => (
            <button
              className="rounded-full border border-[#17372d]/15 bg-white/55 px-3 py-1.5 text-xs transition-colors hover:border-[#b36b3f]/40 hover:bg-white dark:border-border dark:bg-input/10 dark:hover:bg-input/30"
              key={preset.label}
              onClick={() => addPreset(preset.names)}
              type="button"
            >
              + {preset.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {classes.map((item) => (
            <div
              className="flex gap-2 rounded-xl border border-[#17372d]/12 bg-white/55 p-2 dark:border-border dark:bg-input/10"
              key={item.id}
            >
              <Input
                aria-label="Class name"
                className="h-9 min-w-0 flex-1 bg-transparent"
                onChange={(event) =>
                  setClasses((current) =>
                    current.map((row) =>
                      row.id === item.id ? { ...row, name: event.target.value } : row,
                    ),
                  )
                }
                placeholder="Class name"
                value={item.name}
              />
              <Input
                aria-label={`${item.name || "Class"} section`}
                className="h-9 w-20 bg-transparent"
                onChange={(event) =>
                  setClasses((current) =>
                    current.map((row) =>
                      row.id === item.id ? { ...row, section: event.target.value } : row,
                    ),
                  )
                }
                placeholder="Section"
                value={item.section}
              />
              <Button
                aria-label={`Remove ${item.name || "class"}`}
                className="mt-1"
                onClick={() => setClasses((current) => current.filter((row) => row.id !== item.id))}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {!classes.length ? (
            <button
              className="grid min-h-24 place-items-center rounded-xl border border-dashed border-[#17372d]/20 bg-white/35 text-sm text-muted-foreground sm:col-span-2 dark:border-border dark:bg-input/5"
              onClick={addClass}
              type="button"
            >
              Choose a stage set or add your first class
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TeamStep({
  invitations,
  setInvitations,
  addInvitation,
  organizationName,
  schoolName,
  sessionName,
  classes,
}: {
  invitations: InvitationRow[];
  setInvitations: Dispatch<SetStateAction<InvitationRow[]>>;
  addInvitation: () => void;
  organizationName: string;
  schoolName: string;
  sessionName: string;
  classes: ClassRow[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div>
        <div className="flex items-end justify-between">
          <div>
            <Label>Team invitations</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Optional—you can also invite people later.
            </p>
          </div>
          <Button className="rounded-full" onClick={addInvitation} type="button" variant="outline">
            <MailPlus /> Invite
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {invitations.map((item) => (
            <div
              className="grid gap-2 rounded-xl border border-[#17372d]/12 bg-white/55 p-2 sm:grid-cols-[1fr_120px_auto] dark:border-border dark:bg-input/10"
              key={item.id}
            >
              <Input
                aria-label="Invite email"
                className="h-9 bg-transparent"
                onChange={(event) =>
                  setInvitations((current) =>
                    current.map((row) =>
                      row.id === item.id ? { ...row, email: event.target.value } : row,
                    ),
                  )
                }
                placeholder="colleague@school.org"
                type="email"
                value={item.email}
              />
              <Select
                onValueChange={(value: "admin" | "staff" | "viewer") =>
                  setInvitations((current) =>
                    current.map((row) => (row.id === item.id ? { ...row, group: value } : row)),
                  )
                }
                value={item.group}
              >
                <SelectTrigger className="h-9 w-full bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button
                aria-label={`Remove invitation to ${item.email || "team member"}`}
                className="mt-1"
                onClick={() =>
                  setInvitations((current) => current.filter((row) => row.id !== item.id))
                }
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {!invitations.length ? (
            <div className="rounded-xl border border-dashed border-[#17372d]/20 px-4 py-8 text-center dark:border-border">
              <Users className="mx-auto size-5 text-[#b36b3f]" />
              <p className="mt-3 text-sm font-medium">Begin on your own</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Nothing is sent unless you add an invitation.
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <aside className="rounded-[1.5rem] border border-[#17372d]/12 bg-[#fffdf8]/75 p-5 dark:border-border dark:bg-card/70">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-[#b36b3f] uppercase">
          Opening record
        </p>
        <h3 className="mt-3 font-[family-name:var(--font-editorial)] text-2xl leading-none font-medium">
          {organizationName}
        </h3>
        <dl className="mt-5 space-y-4 text-sm">
          <SummaryRow label="Academic year" value={sessionName} />
          <SummaryRow label="First school" value={schoolName} />
          <SummaryRow label="Active classes" value={String(classes.length)} />
          <SummaryRow label="Invitations" value={String(invitations.length)} />
        </dl>
        <p className="mt-6 border-t border-[#17372d]/10 pt-4 text-xs leading-5 text-muted-foreground">
          You will be the first owner with full organization access.
        </p>
      </aside>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <Label>{label}</Label>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 48)
    .replaceAll(/-+$/g, "");
}
