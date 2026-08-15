import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  Building2,
  CalendarDays,
  Check,
  Copy,
  Crown,
  FileText,
  GraduationCap,
  HeartPulse,
  LoaderCircle,
  LockKeyhole,
  MailPlus,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { AccountSettings } from "@/components/account-settings";
import { HealthOperations } from "@/components/health-operations";
import { PeopleRegistry } from "@/components/people-registry";
import { SchoolOperations } from "@/components/school-operations";
import { ScholarshipOperations } from "@/components/scholarship-operations";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";

type AcademicSession = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
};

type PlatformState = {
  needsSetup: boolean;
  sessions: AcademicSession[];
  activeSessionId?: string | null;
  activeOrganizationId?: string | null;
  organizations: Array<{
    id: string;
    name: string;
    group: "owner" | "admin" | "staff" | "viewer";
    defaultSessionId: string | null;
  }>;
  invitation?: InvitationPreview;
};

type InvitationPreview = {
  organizationName: string;
  email: string;
  group: "admin" | "staff" | "viewer";
  roleNames: string[];
  expiresAt: string;
};

type AccessGroup = "owner" | "admin" | "staff" | "viewer";
type AccessRole =
  | "organization_administrator"
  | "registration"
  | "school"
  | "sponsorship"
  | "scholarship"
  | "dispensary"
  | "staff_operations"
  | "auditor";

type OrganizationState = {
  organization: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    locale: string;
  };
  currentMember: {
    id: string;
    group: AccessGroup;
    permissions: string[];
  };
  members: Array<{
    id: string;
    group: AccessGroup;
    joinedAt: string;
    userId: string;
    name: string;
    email: string;
    emailVerified: boolean;
  }>;
  invitations: Array<{
    id: string;
    email: string;
    group: "admin" | "staff" | "viewer";
    expiresAt: string;
    createdAt: string;
    emailStatus: "not_sent" | "sent" | "failed";
    emailSentAt: string | null;
    emailLastAttemptAt: string | null;
    emailAttemptCount: number;
  }>;
  accessModel: {
    permissions: Array<{ key: string; name: string; category: string }>;
    roles: Array<{
      id: string;
      key: AccessRole;
      name: string;
      description: string;
      permissionKeys: string[];
    }>;
    groups: Array<{
      id: string;
      key: AccessGroup;
      name: string;
      description: string;
      roleKeys: AccessRole[];
    }>;
  };
};

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const session = authClient.useSession();
  const [platform, setPlatform] = useState<PlatformState | null>(null);
  const [inviteToken] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("invite") ?? ""),
  );

  useEffect(() => {
    void Promise.all([
      fetch("/api/platform").then((response) => response.json() as Promise<PlatformState>),
      inviteToken
        ? fetch(`/api/invitations/preview?token=${encodeURIComponent(inviteToken)}`).then(
            async (response) =>
              response.ok ? ((await response.json()) as InvitationPreview) : undefined,
          )
        : Promise.resolve(undefined),
    ]).then(([state, invitation]) => setPlatform({ ...state, invitation }));
  }, [inviteToken]);

  if (session.isPending || !platform) {
    return (
      <div className="grid min-h-svh place-items-center bg-muted/50">
        <LoaderCircle className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  if (session.data?.user) {
    return (
      <Launchpad
        platform={platform}
        user={{
          name: session.data.user.name,
          email: session.data.user.email,
          emailVerified: session.data.user.emailVerified,
        }}
      />
    );
  }

  return <AccessScreen inviteToken={inviteToken} platform={platform} />;
}

function AccessScreen({ platform, inviteToken }: { platform: PlatformState; inviteToken: string }) {
  const isInvitation = Boolean(inviteToken && platform.invitation);
  const [mode, setMode] = useState<"sign-in" | "setup">(
    platform.needsSetup || isInvitation ? "setup" : "sign-in",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState(platform.invitation?.email ?? "");
  const [password, setPassword] = useState("");
  const [academicSessionId, setAcademicSessionId] = useState(platform.sessions[0]?.id ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedSession = useMemo(
    () => platform.sessions.find((item) => item.id === academicSessionId),
    [academicSessionId, platform.sessions],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const result =
      mode === "setup"
        ? await authClient.signUp.email(
            { name, email, password },
            isInvitation ? { headers: { "x-tsewa-invitation": inviteToken } } : undefined,
          )
        : await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "We could not complete that request.");
      setSubmitting(false);
      return;
    }

    if (mode === "sign-in" && isInvitation) {
      const acceptance = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: inviteToken }),
      });
      if (!acceptance.ok) {
        const payload = (await acceptance.json()) as { error?: string };
        setError(payload.error ?? "We could not accept this invitation.");
        setSubmitting(false);
        return;
      }
    }

    const chosenSession =
      academicSessionId ||
      (await fetch("/api/platform")
        .then((response) => response.json() as Promise<PlatformState>)
        .then((state) => state.sessions[0]?.id));

    if (chosenSession) {
      await fetch("/api/platform", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ academicSessionId: chosenSession }),
      });
    }

    window.location.reload();
  }

  return (
    <main className="relative grid min-h-svh w-full max-w-none place-items-center overflow-hidden bg-background px-5 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,color-mix(in_oklch,var(--primary)_11%,transparent),transparent_34%),radial-gradient(circle_at_85%_85%,color-mix(in_oklch,var(--primary)_7%,transparent),transparent_36%)]" />
      <div className="absolute inset-y-0 left-0 hidden w-[38%] border-r border-border/70 bg-muted/35 lg:block" />

      <div className="relative grid w-full max-w-5xl gap-14 lg:grid-cols-[1fr_430px] lg:items-center">
        <section className="hidden max-w-lg lg:block">
          <Brand />
          <h1 className="mt-14 text-balance text-5xl font-semibold tracking-[-0.045em] text-foreground">
            One place for people, school, care, and records.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">
            Find a person and see their details, family, school history, care, and documents.
          </p>
          <div className="mt-10 flex flex-wrap gap-2">
            {[
              [Users, "People"],
              [GraduationCap, "School"],
              [HeartPulse, "Care"],
              [FileText, "Documents"],
            ].map(([Icon, label]) => (
              <Badge
                className="gap-1.5 rounded-full px-3 py-1.5"
                key={label as string}
                variant="outline"
              >
                <Icon className="size-3.5" /> {label as string}
              </Badge>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Brand />
            <ThemeToggle />
          </div>
          <div className="mb-5 hidden justify-end lg:flex">
            <ThemeToggle />
          </div>
          <Card className="border-border/80 bg-card/95 shadow-[0_24px_80px_-32px_color-mix(in_oklch,var(--foreground)_28%,transparent)] backdrop-blur">
            <CardHeader className="space-y-2 px-7 pt-7">
              <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                {isInvitation ? <MailPlus /> : mode === "setup" ? <ShieldCheck /> : <LockKeyhole />}
              </div>
              <CardTitle className="text-2xl tracking-[-0.025em]">
                {isInvitation
                  ? mode === "setup"
                    ? `Join ${platform.invitation?.organizationName}`
                    : "Sign in to accept"
                  : mode === "setup"
                    ? "Create the first owner"
                    : "Welcome back"}
              </CardTitle>
              <CardDescription className="leading-6">
                {isInvitation
                  ? `You have been invited as ${platform.invitation?.group}. Use ${platform.invitation?.email}.`
                  : mode === "setup"
                    ? "Create your organization and its first owner account."
                    : "Sign in to your organization."}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-7 pb-7">
              <form className="space-y-5" onSubmit={submit}>
                {mode === "setup" ? (
                  <div className="space-y-2">
                    <Label htmlFor="name">Your name</Label>
                    <Input
                      autoComplete="name"
                      id="name"
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Asha Tenzin"
                      required
                      value={name}
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    autoComplete="email"
                    id="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@organisation.org"
                    readOnly={isInvitation}
                    required
                    type="email"
                    value={email}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    autoComplete={mode === "setup" ? "new-password" : "current-password"}
                    id="password"
                    minLength={10}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 10 characters"
                    required
                    type="password"
                    value={password}
                  />
                </div>
                {mode === "sign-in" && platform.sessions.length ? (
                  <div className="space-y-2">
                    <Label htmlFor="academic-session">Academic session</Label>
                    <Select onValueChange={setAcademicSessionId} value={academicSessionId}>
                      <SelectTrigger
                        className="h-10 w-full rounded-full bg-muted/70 px-4"
                        id="academic-session"
                      >
                        <CalendarDays className="size-4 text-muted-foreground" />
                        <SelectValue placeholder="Select a session" />
                      </SelectTrigger>
                      <SelectContent>
                        {platform.sessions.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedSession ? (
                      <p className="text-xs text-muted-foreground">
                        {selectedSession.startsOn} — {selectedSession.endsOn}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {error ? (
                  <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <Button
                  className="h-11 w-full rounded-full text-sm"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? <LoaderCircle className="animate-spin" /> : null}
                  {mode === "setup" ? "Create account" : "Sign in"}
                  {!submitting ? <ArrowRight /> : null}
                </Button>
              </form>
              {platform.needsSetup || isInvitation ? (
                <button
                  className="mt-5 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => setMode(mode === "setup" ? "sign-in" : "setup")}
                  type="button"
                >
                  {mode === "setup"
                    ? "I already have an account"
                    : isInvitation
                      ? "Create a new account"
                      : "Set up this installation"}
                </button>
              ) : null}
            </CardContent>
          </Card>
          <p className="mt-5 text-center text-xs text-muted-foreground">
            Self-hosted on Cloudflare · Your data stays with your organization
          </p>
        </section>
      </div>
    </main>
  );
}

function Brand({ organizationName = "Tibetan Homes Foundation" }: { organizationName?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
        TS
      </div>
      <div>
        <div className="text-sm font-semibold tracking-tight text-foreground">Tsewa</div>
        <div className="text-xs text-muted-foreground">{organizationName}</div>
      </div>
    </div>
  );
}

function Launchpad({
  platform,
  user,
}: {
  platform: PlatformState;
  user: { name: string; email: string; emailVerified: boolean };
}) {
  const [view, setView] = useState<"home" | "people" | "school" | "health" | "scholarship">("home");
  const [activeSessionId, setActiveSessionId] = useState(
    platform.activeSessionId ?? platform.sessions[0]?.id ?? "",
  );
  const activeOrganization = platform.organizations.find(
    (organization) => organization.id === platform.activeOrganizationId,
  );
  const modules = [
    {
      Icon: Users,
      title: "People",
      description: "Personal details, family, placement, and documents",
      view: "people",
      open: true,
    },
    {
      Icon: GraduationCap,
      title: "School",
      description: "Students, classes, marks, and results",
      view: "school",
      open: true,
    },
    {
      Icon: HeartPulse,
      title: "Health",
      description: "Visits, treatment, and health history",
      view: "health",
      open: true,
    },
    {
      Icon: Award,
      title: "Scholarships",
      description: "Awards, progress, sanctions, advances, and reports",
      view: "scholarship",
      open: true,
    },
    {
      Icon: FileText,
      title: "Reports and documents",
      description: "Documents and reports",
      view: "home",
      open: false,
    },
  ] as const;

  if (view === "people") {
    return <PeopleRegistry onBack={() => setView("home")} />;
  }

  if (view === "health") {
    return <HealthOperations onBack={() => setView("home")} />;
  }

  if (view === "scholarship") {
    return (
      <ScholarshipOperations activeSessionId={activeSessionId} onBack={() => setView("home")} />
    );
  }

  async function changeSession(sessionId: string) {
    const previous = activeSessionId;
    setActiveSessionId(sessionId);
    const response = await fetch("/api/platform", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ academicSessionId: sessionId }),
    });
    if (!response.ok) {
      setActiveSessionId(previous);
      throw new Error("The academic session could not be changed.");
    }
  }

  async function changeOrganization(organizationId: string) {
    const organization = platform.organizations.find((item) => item.id === organizationId);
    if (!organization?.defaultSessionId) return;
    const response = await fetch("/api/platform", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ academicSessionId: organization.defaultSessionId }),
    });
    if (response.ok) window.location.reload();
  }

  if (view === "school") {
    return (
      <SchoolOperations
        activeSessionId={activeSessionId}
        onBack={() => setView("home")}
        onSessionChange={changeSession}
        sessions={platform.sessions}
      />
    );
  }

  return (
    <main className="min-h-svh w-full max-w-none bg-muted/35">
      <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-background/95 px-5 backdrop-blur md:px-8">
        <Brand organizationName={activeOrganization?.name} />
        <div className="ml-auto flex items-center gap-3">
          {platform.organizations.length > 1 ? (
            <Select
              onValueChange={(value) => void changeOrganization(value)}
              value={platform.activeOrganizationId ?? undefined}
            >
              <SelectTrigger
                aria-label="Organization"
                className="w-10 rounded-full px-0 sm:w-48 sm:px-3 md:w-52"
              >
                <Building2 className="size-4" />
                <span className="hidden min-w-0 truncate sm:block">
                  <SelectValue placeholder="Organization" />
                </span>
              </SelectTrigger>
              <SelectContent>
                {platform.organizations.map((organization) => (
                  <SelectItem
                    disabled={!organization.defaultSessionId}
                    key={organization.id}
                    value={organization.id}
                  >
                    {organization.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select onValueChange={(value) => void changeSession(value)} value={activeSessionId}>
            <SelectTrigger
              aria-label="Academic session"
              className="hidden w-36 rounded-full sm:flex"
            >
              <CalendarDays className="size-4" />
              <SelectValue placeholder="Session" />
            </SelectTrigger>
            <SelectContent>
              {platform.sessions.map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  {session.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ThemeToggle />
          <Button
            onClick={() => void authClient.signOut().then(() => window.location.reload())}
            variant="ghost"
          >
            Sign out
          </Button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <p className="text-sm font-medium text-primary">Home</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] md:text-4xl">
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-3 text-muted-foreground">Choose an area to continue.</p>
        <div className="mt-9 grid gap-4 md:grid-cols-2">
          {modules.map(({ Icon, title, description, open, view }) => {
            const card = (
              <Card
                className={
                  open
                    ? "h-full border-primary/25 transition-colors group-hover:border-primary/50"
                    : "opacity-70"
                }
              >
                <CardHeader className="flex-row items-start gap-4 text-left">
                  <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Icon />
                  </div>
                  <div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription className="mt-1.5">{description}</CardDescription>
                  </div>
                  <Badge className="ml-auto rounded-full" variant={open ? "default" : "secondary"}>
                    {open ? "Open" : "Planned"}
                  </Badge>
                </CardHeader>
              </Card>
            );

            return open ? (
              <button
                className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                key={title}
                onClick={() => setView(view)}
                type="button"
              >
                {card}
              </button>
            ) : (
              <div key={title}>{card}</div>
            );
          })}
        </div>
        <AccountSettings user={user} />
        <AdministrationPanel />
      </div>
    </main>
  );
}

function AdministrationPanel() {
  const [state, setState] = useState<OrganizationState | null>(null);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [locale, setLocale] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteGroup, setInviteGroup] = useState<"admin" | "staff" | "viewer">("admin");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [pendingMemberGroups, setPendingMemberGroups] = useState<Set<string>>(() => new Set());
  const [pendingAccessGroups, setPendingAccessGroups] = useState<Set<AccessGroup>>(() => new Set());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const response = await fetch("/api/organization");
    if (!response.ok) return;
    const next = (await response.json()) as OrganizationState;
    setState(next);
    setName(next.organization.name);
    setTimezone(next.organization.timezone);
    setLocale(next.organization.locale);
  }

  useEffect(() => {
    void refresh();
  }, []);

  function startRequest(label: string) {
    setBusy(label);
    setMessage("");
    setError("");
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startRequest("settings");
    const response = await fetch("/api/organization", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, timezone, locale }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) setError(payload.error ?? "Settings could not be saved.");
    else {
      setMessage("Organization settings saved.");
      await refresh();
    }
    setBusy("");
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startRequest("invite");
    setInvitationUrl("");
    const response = await fetch("/api/organization/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, group: inviteGroup }),
    });
    const payload = (await response.json()) as {
      error?: string;
      invitationUrl?: string;
      delivery?: { status: "sent" | "failed" };
    };
    if (!response.ok) setError(payload.error ?? "Invitation could not be created.");
    else if (payload.invitationUrl) {
      setInvitationUrl(payload.invitationUrl);
      setMessage(
        payload.delivery?.status === "sent"
          ? "Invitation created and emailed."
          : "Invitation created, but email delivery failed. Copy the private link below.",
      );
      setInviteEmail("");
      await refresh();
    }
    setBusy("");
  }

  async function changeGroup(memberId: string, group: "admin" | "staff" | "viewer") {
    const previousGroup = state?.members.find((member) => member.id === memberId)?.group;
    if (!previousGroup || previousGroup === group) return;

    setMessage("");
    setError("");
    setPendingMemberGroups((current) => new Set(current).add(memberId));
    setState((current) =>
      current
        ? {
            ...current,
            members: current.members.map((member) =>
              member.id === memberId ? { ...member, group } : member,
            ),
          }
        : current,
    );

    try {
      const response = await fetch(`/api/organization/members/${memberId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ group }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setState((current) =>
          current
            ? {
                ...current,
                members: current.members.map((member) =>
                  member.id === memberId && member.group === group
                    ? { ...member, group: previousGroup }
                    : member,
                ),
              }
            : current,
        );
        setError(payload.error ?? "The access group could not be changed.");
        return;
      }
      setMessage("Member access group updated.");
    } catch {
      setState((current) =>
        current
          ? {
              ...current,
              members: current.members.map((member) =>
                member.id === memberId && member.group === group
                  ? { ...member, group: previousGroup }
                  : member,
              ),
            }
          : current,
      );
      setError("The access group could not be changed.");
    } finally {
      setPendingMemberGroups((current) => {
        const next = new Set(current);
        next.delete(memberId);
        return next;
      });
    }
  }

  async function transferOwnership(memberId: string, memberName: string) {
    const confirmed = window.confirm(
      `Transfer ownership to ${memberName}? Your role will change to administrator.`,
    );
    if (!confirmed) return;
    startRequest(`transfer-${memberId}`);
    const response = await fetch("/api/organization/transfer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetMemberId: memberId }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) setError(payload.error ?? "Ownership could not be transferred.");
    else {
      setMessage(`Ownership transferred to ${memberName}.`);
      await refresh();
    }
    setBusy("");
  }

  async function revokeInvitation(invitationId: string) {
    startRequest(invitationId);
    const response = await fetch(`/api/organization/invitations/${invitationId}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) setError(payload.error ?? "Invitation could not be revoked.");
    else {
      setMessage("Invitation revoked.");
      await refresh();
    }
    setBusy("");
  }

  async function resendInvitation(invitationId: string) {
    startRequest(`resend-${invitationId}`);
    const response = await fetch(`/api/organization/invitations/${invitationId}/resend`, {
      method: "POST",
    });
    const payload = (await response.json()) as {
      error?: string;
      invitationUrl?: string;
      delivery?: { status: "sent" | "failed" };
    };
    if (!response.ok) setError(payload.error ?? "Invitation could not be resent.");
    else {
      setInvitationUrl(payload.invitationUrl ?? "");
      setMessage(
        payload.delivery?.status === "sent"
          ? "A fresh invitation was emailed. The old link no longer works."
          : "The link was refreshed, but email delivery failed. Copy the new link below.",
      );
      await refresh();
    }
    setBusy("");
  }

  async function saveGroupRoles(group: Exclude<AccessGroup, "owner">, roleKeys: AccessRole[]) {
    const previousRoleKeys = state?.accessModel.groups.find((item) => item.key === group)?.roleKeys;
    if (!previousRoleKeys) return;

    setMessage("");
    setError("");
    setPendingAccessGroups((current) => new Set(current).add(group));
    setState((current) =>
      current
        ? {
            ...current,
            accessModel: {
              ...current.accessModel,
              groups: current.accessModel.groups.map((item) =>
                item.key === group ? { ...item, roleKeys } : item,
              ),
            },
          }
        : current,
    );

    try {
      const response = await fetch(`/api/organization/groups/${group}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleKeys }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setState((current) =>
          current
            ? {
                ...current,
                accessModel: {
                  ...current.accessModel,
                  groups: current.accessModel.groups.map((item) =>
                    item.key === group && sameRoleKeys(item.roleKeys, roleKeys)
                      ? { ...item, roleKeys: previousRoleKeys }
                      : item,
                  ),
                },
              }
            : current,
        );
        setError(payload.error ?? "Group roles could not be saved.");
        return;
      }
      setMessage(`${groupLabel(group)} access updated.`);
    } catch {
      setState((current) =>
        current
          ? {
              ...current,
              accessModel: {
                ...current.accessModel,
                groups: current.accessModel.groups.map((item) =>
                  item.key === group && sameRoleKeys(item.roleKeys, roleKeys)
                    ? { ...item, roleKeys: previousRoleKeys }
                    : item,
                ),
              },
            }
          : current,
      );
      setError("Group roles could not be saved.");
    } finally {
      setPendingAccessGroups((current) => {
        const next = new Set(current);
        next.delete(group);
        return next;
      });
    }
  }

  if (!state) {
    return (
      <Card className="mt-10">
        <CardContent className="grid min-h-36 place-items-center">
          <LoaderCircle className="size-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const canManageSettings = state.currentMember.permissions.includes(
    "organization.settings.manage",
  );
  const canManageMembers = state.currentMember.permissions.includes("organization.members.manage");
  const canManageRoles = state.currentMember.permissions.includes("organization.roles.manage");
  const isOwner = state.currentMember.group === "owner";

  return (
    <section className="mt-12" id="administration">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Administration</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
            Organization and access
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Update organization details and manage who can sign in.
          </p>
        </div>
        <Badge className="w-fit gap-1.5 rounded-full" variant="outline">
          {isOwner ? <Crown className="size-3.5" /> : <UserCog className="size-3.5" />}
          {groupLabel(state.currentMember.group)}
        </Badge>
      </div>

      {message ? (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-primary">
          <Check className="size-4" /> {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[0.92fr_1.35fr]">
        <Card>
          <CardHeader>
            <div className="mb-2 grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </div>
            <CardTitle>Organization profile</CardTitle>
            <CardDescription>These details are shown throughout Tsewa.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={saveSettings}>
              <div className="space-y-2">
                <Label htmlFor="organization-name">Organization name</Label>
                <Input
                  disabled={!canManageSettings}
                  id="organization-name"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="organization-timezone">Timezone</Label>
                  <Input
                    disabled={!canManageSettings}
                    id="organization-timezone"
                    onChange={(event) => setTimezone(event.target.value)}
                    value={timezone}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-locale">Locale</Label>
                  <Input
                    disabled={!canManageSettings}
                    id="organization-locale"
                    onChange={(event) => setLocale(event.target.value)}
                    value={locale}
                  />
                </div>
              </div>
              <Button disabled={!canManageSettings || busy === "settings"} type="submit">
                {busy === "settings" ? <LoaderCircle className="animate-spin" /> : <Settings />}
                Save settings
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Members</CardTitle>
                <CardDescription className="mt-1.5">
                  {state.members.length} active {state.members.length === 1 ? "member" : "members"}
                </CardDescription>
              </div>
              <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                <Users className="size-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.members.map((member) => {
              const isCurrent = member.id === state.currentMember.id;
              return (
                <div
                  className="flex flex-col gap-3 rounded-2xl border bg-muted/25 p-4 sm:flex-row sm:items-center"
                  key={member.id}
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                    {initials(member.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{member.name}</p>
                      {isCurrent ? <Badge variant="secondary">You</Badge> : null}
                      {member.group === "owner" ? (
                        <Badge className="gap-1 rounded-full">
                          <Crown className="size-3" /> Owner
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  {!isCurrent && canManageMembers && member.group !== "owner" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        disabled={pendingMemberGroups.has(member.id)}
                        onValueChange={(value) =>
                          void changeGroup(member.id, value as "admin" | "staff" | "viewer")
                        }
                        value={member.group}
                      >
                        <SelectTrigger className="h-9 w-28 rounded-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        disabled={busy === `transfer-${member.id}`}
                        onClick={() => void transferOwnership(member.id, member.name)}
                        size="sm"
                        variant="outline"
                      >
                        <Crown /> Transfer
                      </Button>
                    </div>
                  ) : member.group !== "owner" ? (
                    <Badge className="w-fit rounded-full" variant="outline">
                      {groupLabel(member.group)}
                    </Badge>
                  ) : null}
                </div>
              );
            })}

            {canManageMembers ? (
              <form className="mt-5 rounded-2xl border border-dashed p-4" onSubmit={inviteMember}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MailPlus className="size-4 text-primary" /> Invite a member
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Tsewa emails a private seven-day link and records the delivery result.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
                  <Input
                    aria-label="Invitee email"
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="person@example.org"
                    required
                    type="email"
                    value={inviteEmail}
                  />
                  <Select
                    onValueChange={(value) => setInviteGroup(value as typeof inviteGroup)}
                    value={inviteGroup}
                  >
                    <SelectTrigger className="w-full rounded-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button disabled={busy === "invite"} type="submit">
                    {busy === "invite" ? <LoaderCircle className="animate-spin" /> : <MailPlus />}
                    Invite
                  </Button>
                </div>
                {invitationUrl ? (
                  <div className="mt-3 flex gap-2 rounded-xl bg-muted p-2 pl-3">
                    <p className="min-w-0 flex-1 self-center truncate font-mono text-xs text-muted-foreground">
                      {invitationUrl}
                    </p>
                    <Button
                      onClick={() => {
                        void navigator.clipboard.writeText(invitationUrl);
                        setMessage("Invitation link copied.");
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <Copy /> Copy
                    </Button>
                  </div>
                ) : null}
              </form>
            ) : null}

            {state.invitations.length ? (
              <div className="pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Pending invitations
                </p>
                {state.invitations.map((invitation) => (
                  <div className="flex items-center gap-3 border-t py-3" key={invitation.id}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{invitation.email}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {groupLabel(invitation.group)} ·{" "}
                        {invitation.emailStatus === "sent"
                          ? "emailed"
                          : invitation.emailStatus === "failed"
                            ? "email failed"
                            : "not emailed"}{" "}
                        · expires {formatShortDate(invitation.expiresAt)}
                      </p>
                    </div>
                    {canManageMembers ? (
                      <div className="flex items-center gap-1">
                        <Button
                          disabled={busy === `resend-${invitation.id}`}
                          onClick={() => void resendInvitation(invitation.id)}
                          size="sm"
                          variant="ghost"
                        >
                          Resend
                        </Button>
                        <Button
                          aria-label={`Revoke invitation for ${invitation.email}`}
                          disabled={busy === invitation.id}
                          onClick={() => void revokeInvitation(invitation.id)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <X />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Access groups and functional roles</CardTitle>
          <CardDescription>
            Every member belongs to one access group. A group receives explicit permissions through
            its functional roles; owner always retains every role.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {state.accessModel.groups
            .filter((group) => group.key !== "owner")
            .map((group) => (
              <div className="rounded-2xl border bg-muted/20 p-4" key={group.id}>
                <div>
                  <p className="font-semibold">{group.name}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {group.description}
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  {state.accessModel.roles.map((role) => {
                    const selected = group.roleKeys.includes(role.key);
                    const nextRoles = selected
                      ? group.roleKeys.filter((roleKey) => roleKey !== role.key)
                      : [...group.roleKeys, role.key];
                    return (
                      <button
                        aria-pressed={selected}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                          selected
                            ? "border-primary/30 bg-primary/8"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                        disabled={!canManageRoles || pendingAccessGroups.has(group.key)}
                        key={role.id}
                        onClick={() =>
                          void saveGroupRoles(group.key as Exclude<AccessGroup, "owner">, nextRoles)
                        }
                        type="button"
                      >
                        <span className="flex items-center justify-between gap-3 text-sm font-medium">
                          {role.name}
                          {selected ? <Check className="size-4 text-primary" /> : null}
                        </span>
                        <span className="mt-1 block text-xs leading-4 text-muted-foreground">
                          {role.permissionKeys.length} explicit permissions
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </section>
  );
}

function groupLabel(group: AccessGroup): string {
  return group === "admin" ? "Administrator" : group.charAt(0).toUpperCase() + group.slice(1);
}

function sameRoleKeys(left: AccessRole[], right: AccessRole[]): boolean {
  return left.length === right.length && left.every((roleKey) => right.includes(roleKey));
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
    new Date(value),
  );
}
