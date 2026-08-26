import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Award,
  Building2,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CreditCard,
  Crown,
  FileText,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  History,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  MailPlus,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";

import { AccountSettings } from "@/components/account-settings";
import { BillingSettings } from "@/components/billing-settings";
import { HealthOperations } from "@/components/health-operations";
import type { HealthFilters } from "@/components/health-operations";
import { PeopleRegistry } from "@/components/people-registry";
import type { PeopleFilters } from "@/components/people-registry";
import { ReportsCentre } from "@/components/reports-centre";
import type { ReportsFilters } from "@/components/reports-centre";
import { SchoolOperations } from "@/components/school-operations";
import type { SchoolFilters } from "@/components/school-operations";
import { ScholarshipOperations } from "@/components/scholarship-operations";
import type { ScholarshipFilters } from "@/components/scholarship-operations";
import { SponsorshipOperations } from "@/components/sponsorship-operations";
import type { SponsorshipFilters } from "@/components/sponsorship-operations";
import { StaffOperations } from "@/components/staff-operations";
import type { StaffFilters } from "@/components/staff-operations";
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
import { homeSearchSchema } from "@/lib/route-search";

type AcademicSession = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
};

type PlatformState = {
  deployment: {
    appName: string;
    mode: "hosted" | "self-hosted";
    capabilities: {
      allowsInitialOwnerBootstrap: boolean;
      allowsPublicSignup: boolean;
      requiresBilling: boolean;
      requiresEmailVerification: boolean;
      supportsMultipleOrganizations: boolean;
    };
  };
  brand: {
    organizationName: string | null;
    organizationTitle: string | null;
    logoUrl: string | null;
  };
  needsSetup: boolean;
  sessions: AcademicSession[];
  activeSessionId?: string | null;
  activeOrganizationId?: string | null;
  organizations: Array<{
    id: string;
    name: string;
    displayTitle: string | null;
    logoAssetKey: string | null;
    logoUrl: string | null;
    updatedAt: string;
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
  | "reports"
  | "scholarship"
  | "dispensary"
  | "staff_operations"
  | "auditor";

type OrganizationState = {
  organization: {
    id: string;
    name: string;
    slug: string;
    displayTitle: string | null;
    logoAssetKey: string | null;
    logoUrl: string | null;
    updatedAt: string;
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

export type AppView =
  | "dashboard"
  | "people"
  | "school"
  | "health"
  | "scholarship"
  | "sponsorship"
  | "staff"
  | "reports"
  | "settings";
export type SettingsTab =
  | "general"
  | "sessions"
  | "members"
  | "roles"
  | "billing"
  | "security"
  | "audit";
export type RoutedAppSearch = {
  q?: string;
  page?: number;
  kind?: string;
  status?: string;
  school?: string;
  class?: string;
  house?: string;
  section?: string;
  course?: string;
  outcome?: string;
  settlement?: string;
  department?: string;
  domain?: string;
  report?: string;
  session?: string;
  auditQ?: string;
  auditAction?: string;
  auditPage?: number;
  rosterQ?: string;
  rosterSchool?: string;
  resultQ?: string;
  resultSession?: string;
  resultSchool?: string;
  resultClass?: string;
  resultSubject?: string;
  resultTerm?: string;
  resultPage?: number;
};
type RoutedSearchChange = {
  bivarianceHack(search: RoutedAppSearch): void;
}["bivarianceHack"];
type DashboardModule = {
  Icon: LucideIcon;
  title: string;
  description: string;
  view: AppView;
  open: boolean;
};

type DashboardState = {
  session: AcademicSession;
  metrics: Record<
    "people" | "school" | "scholarships" | "sponsorships" | "health",
    { value: number; total: number } | null
  >;
  activity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    occurredAt: string;
    actorName: string | null;
  }>;
};

export const Route = createFileRoute("/")({
  validateSearch: homeSearchSchema,
  component: Home,
});

function Home() {
  const session = authClient.useSession();
  const search = Route.useSearch();
  const [platform, setPlatform] = useState<PlatformState | null>(null);
  const inviteToken = search.invite ?? "";

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

  if (inviteToken) {
    return <Navigate params={{ token: inviteToken }} replace to="/invite/$token" />;
  }

  if (session.data?.user) {
    if (platform.deployment.mode === "hosted" && !platform.activeOrganizationId) {
      return <Navigate replace to="/onboarding" />;
    }
    if (search.view === "settings") {
      return (
        <Navigate params={{ tab: search.settingsTab ?? "general" }} replace to="/settings/$tab" />
      );
    }
    return <Navigate replace to={legacyViewPath(search.view)} />;
  }

  return <AccessScreen inviteToken={inviteToken} platform={platform} />;
}

export function InvitationPage({ token }: { token: string }) {
  const session = authClient.useSession();
  const [platform, setPlatform] = useState<PlatformState | null>(null);
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [failure, setFailure] = useState<{ code: string; error: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetch("/api/platform", { signal: controller.signal }).then(
        (response) => response.json() as Promise<PlatformState>,
      ),
      fetch(`/api/invitations/preview?token=${encodeURIComponent(token)}`, {
        signal: controller.signal,
      }).then(async (response) => {
        const payload = (await response.json()) as InvitationPreview & {
          code?: string;
          error?: string;
        };
        if (!response.ok) {
          throw {
            code: payload.code ?? "invalid",
            error: payload.error ?? "Invitation unavailable",
          };
        }
        return payload;
      }),
    ])
      .then(([state, preview]) => {
        setPlatform({ ...state, invitation: preview });
        setInvitation(preview);
      })
      .catch((reason: unknown) => {
        if ((reason as { name?: string }).name === "AbortError") return;
        const detail = reason as { code?: string; error?: string };
        setFailure({
          code: detail.code ?? "invalid",
          error: detail.error ?? "This invitation could not be opened.",
        });
      });
    return () => controller.abort();
  }, [token]);

  async function accept() {
    setSubmitting(true);
    setError("");
    const response = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "The invitation could not be accepted.");
      setSubmitting(false);
      return;
    }
    window.location.assign("/dashboard");
  }

  if (session.isPending || (!platform && !failure)) {
    return (
      <div className="grid min-h-svh place-items-center bg-muted/50">
        <LoaderCircle className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  if (failure) {
    const titles: Record<string, string> = {
      expired: "Invitation expired",
      revoked: "Invitation revoked",
      used: "Invitation already accepted",
      invalid: "Invalid invitation",
    };
    return (
      <InvitationStateCard
        description={`${failure.error} Ask an organization administrator to send a fresh invitation if you still need access.`}
        title={titles[failure.code] ?? "Invitation unavailable"}
      />
    );
  }

  if (!session.data?.user && platform) {
    return <AccessScreen inviteToken={token} platform={platform} />;
  }

  if (session.data?.user && invitation) {
    const wrongAccount = session.data.user.email.toLowerCase() !== invitation.email.toLowerCase();
    return (
      <InvitationStateCard
        action={
          wrongAccount ? (
            <Button
              className="w-full"
              onClick={() => void authClient.signOut().then(() => window.location.reload())}
              variant="outline"
            >
              Sign out and use {invitation.email}
            </Button>
          ) : (
            <Button className="w-full" disabled={submitting} onClick={() => void accept()}>
              {submitting ? <LoaderCircle className="animate-spin" /> : <MailPlus />}
              Accept invitation
            </Button>
          )
        }
        description={
          wrongAccount
            ? `This invitation is for ${invitation.email}, but you are signed in as ${session.data.user.email}.`
            : `Join ${invitation.organizationName} as ${invitation.group}. Your assigned roles are ${invitation.roleNames.join(", ") || "set by the organization"}.`
        }
        error={error}
        title={wrongAccount ? "Use the invited account" : `Join ${invitation.organizationName}`}
      />
    );
  }

  return null;
}

function InvitationStateCard({
  action,
  description,
  error,
  title,
}: {
  action?: ReactNode;
  description: string;
  error?: string;
  title: string;
}) {
  return (
    <main className="grid min-h-svh place-items-center bg-muted/35 px-5 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
            <MailPlus />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="leading-6">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {action}
          <Button asChild className="w-full" variant="ghost">
            <a href="/">Return to sign in</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export function AuthenticatedApp({
  onSearchChange,
  view,
  settingsTab = "general",
  search = {},
}: {
  onSearchChange?: RoutedSearchChange;
  view: AppView;
  settingsTab?: SettingsTab;
  search?: RoutedAppSearch;
}) {
  const session = authClient.useSession();
  const [platform, setPlatform] = useState<PlatformState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/platform", { signal: controller.signal })
      .then((response) => response.json() as Promise<PlatformState>)
      .then(setPlatform)
      .catch((cause: unknown) => {
        if ((cause as { name?: string }).name !== "AbortError") setPlatform(null);
      });
    return () => controller.abort();
  }, []);

  if (session.isPending || !platform) {
    return (
      <div className="grid min-h-svh place-items-center bg-muted/50">
        <LoaderCircle className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!session.data?.user) return <Navigate replace to="/" />;
  if (platform.deployment.mode === "hosted" && !platform.activeOrganizationId) {
    return <Navigate replace to="/onboarding" />;
  }

  return (
    <Launchpad
      platform={platform}
      onSearchChange={onSearchChange}
      search={search}
      settingsTab={settingsTab}
      user={{
        name: session.data.user.name,
        email: session.data.user.email,
        emailVerified: session.data.user.emailVerified,
      }}
      view={view}
    />
  );
}

function legacyViewPath(view?: AppView) {
  if (view === "people") return "/people" as const;
  if (view === "school") return "/school" as const;
  if (view === "health") return "/health" as const;
  if (view === "scholarship") return "/scholarships" as const;
  if (view === "sponsorship") return "/sponsorships" as const;
  if (view === "staff") return "/staff" as const;
  if (view === "reports") return "/reports" as const;
  return "/dashboard" as const;
}

function AccessScreen({ platform, inviteToken }: { platform: PlatformState; inviteToken: string }) {
  const isInvitation = Boolean(inviteToken && platform.invitation);
  const canCreateAccount =
    platform.needsSetup || isInvitation || platform.deployment.capabilities.allowsPublicSignup;
  const [mode, setMode] = useState<"sign-in" | "setup" | "recovery" | "verify">(
    platform.needsSetup || isInvitation ? "setup" : "sign-in",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState(platform.invitation?.email ?? "");
  const [password, setPassword] = useState("");
  const [academicSessionId, setAcademicSessionId] = useState(platform.sessions[0]?.id ?? "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");

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
            {
              name,
              email,
              password,
              callbackURL: platform.deployment.mode === "hosted" ? "/onboarding" : "/dashboard",
            },
            isInvitation ? { headers: { "x-tsewa-invitation": inviteToken } } : undefined,
          )
        : await authClient.signIn.email(
            { email, password },
            isInvitation ? { headers: { "x-tsewa-invitation": inviteToken } } : undefined,
          );

    if (result.error) {
      if (
        result.error.code === "EMAIL_NOT_VERIFIED" ||
        result.error.message?.toLowerCase().includes("verify your email")
      ) {
        setVerificationEmail(email.trim().toLowerCase());
        setNotice("We sent a fresh verification link.");
        setMode("verify");
        setSubmitting(false);
        return;
      }
      setError(result.error.message ?? "We could not complete that request.");
      setSubmitting(false);
      return;
    }

    if (
      mode === "setup" &&
      !isInvitation &&
      platform.deployment.capabilities.requiresEmailVerification
    ) {
      setVerificationEmail(email.trim().toLowerCase());
      setNotice("Your account was created and a verification link is on its way.");
      setMode("verify");
      setSubmitting(false);
      return;
    }

    if (mode === "setup" && !isInvitation) {
      window.location.assign("/dashboard");
      return;
    }

    if (mode === "setup" && isInvitation) {
      const signIn = await authClient.signIn.email({ email, password });
      if (signIn.error) {
        setError(signIn.error.message ?? "Your account was created, but sign-in failed.");
        setSubmitting(false);
        return;
      }
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

    window.location.assign("/dashboard");
  }

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    const response = await fetch("/api/auth/request-password-reset", {
      body: JSON.stringify({ email, redirectTo: "/reset-password" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setSubmitting(false);
    if (!response.ok) {
      setError("We could not send a recovery email. Please try again.");
      return;
    }
    setNotice("If that email belongs to an account, a private reset link is on its way.");
  }

  async function resendVerification() {
    setError("");
    setNotice("");
    setSubmitting(true);
    const result = await authClient.sendVerificationEmail({
      email: verificationEmail,
      callbackURL: platform.deployment.mode === "hosted" ? "/onboarding" : "/dashboard",
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? "We could not send another verification email.");
      return;
    }
    setNotice("A fresh verification link is on its way.");
  }

  if (mode === "verify") {
    return (
      <EmailVerificationScreen
        brand={platform.brand}
        email={verificationEmail}
        error={error}
        notice={notice}
        onBack={() => {
          setError("");
          setNotice("");
          setMode("sign-in");
        }}
        onResend={() => void resendVerification()}
        submitting={submitting}
      />
    );
  }

  return (
    <main className="relative grid min-h-svh w-full max-w-none place-items-center overflow-hidden bg-background px-5 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,color-mix(in_oklch,var(--primary)_11%,transparent),transparent_34%),radial-gradient(circle_at_85%_85%,color-mix(in_oklch,var(--primary)_7%,transparent),transparent_36%)]" />
      <div className="absolute inset-y-0 left-0 hidden w-[38%] border-r border-border/70 bg-muted/35 lg:block" />

      <div className="relative grid w-full max-w-5xl gap-14 lg:grid-cols-[1fr_430px] lg:items-center">
        <section className="hidden max-w-lg lg:block">
          <Brand
            logoUrl={platform.brand.logoUrl}
            organizationName={platform.brand.organizationName}
            organizationTitle={platform.brand.organizationTitle}
            prominent
          />
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
            <Brand
              logoUrl={platform.brand.logoUrl}
              organizationName={platform.brand.organizationName}
              organizationTitle={platform.brand.organizationTitle}
              prominent
            />
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
                    ? platform.deployment.mode === "hosted"
                      ? "Create your Tsewa account"
                      : "Create the first owner"
                    : mode === "recovery"
                      ? "Reset your password"
                      : "Welcome back"}
              </CardTitle>
              <CardDescription className="leading-6">
                {isInvitation
                  ? `You have been invited as ${platform.invitation?.group}. Use ${platform.invitation?.email}.`
                  : mode === "setup"
                    ? platform.deployment.mode === "hosted"
                      ? "Verify your email, then set up your organization and first academic year."
                      : `Create the first owner account for ${platform.brand.organizationName ?? "this installation"}.`
                    : mode === "recovery"
                      ? "We will email a private reset link if the account exists."
                      : "Sign in to your organization."}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-7 pb-7">
              <form className="space-y-5" onSubmit={mode === "recovery" ? requestRecovery : submit}>
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
                {mode !== "recovery" ? (
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
                ) : null}
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
                        {formatSessionRange(selectedSession)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {error ? (
                  <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                {notice ? (
                  <p className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-foreground">
                    {notice}
                  </p>
                ) : null}
                <Button
                  className="h-11 w-full rounded-full text-sm"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? <LoaderCircle className="animate-spin" /> : null}
                  {mode === "setup"
                    ? platform.deployment.mode === "hosted"
                      ? "Continue with email"
                      : "Create account"
                    : mode === "recovery"
                      ? "Send reset link"
                      : "Sign in"}
                  {!submitting ? <ArrowRight /> : null}
                </Button>
              </form>
              {mode === "sign-in" && !isInvitation ? (
                <button
                  className="mt-5 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => {
                    setError("");
                    setNotice("");
                    setMode("recovery");
                  }}
                  type="button"
                >
                  Forgot your password?
                </button>
              ) : null}
              {mode === "recovery" ? (
                <button
                  className="mt-5 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => {
                    setError("");
                    setNotice("");
                    setMode("sign-in");
                  }}
                  type="button"
                >
                  Return to sign in
                </button>
              ) : null}
              {canCreateAccount ? (
                <button
                  className="mt-5 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => setMode(mode === "setup" ? "sign-in" : "setup")}
                  type="button"
                >
                  {mode === "setup"
                    ? "I already have an account"
                    : isInvitation
                      ? "Create a new account"
                      : platform.deployment.mode === "hosted"
                        ? "Create a new organization"
                        : "Set up this installation"}
                </button>
              ) : null}
            </CardContent>
          </Card>
          <p className="mt-5 text-center text-xs text-muted-foreground">
            Secure access for authorized staff
          </p>
        </section>
      </div>
    </main>
  );
}

function EmailVerificationScreen({
  brand,
  email,
  error,
  notice,
  onBack,
  onResend,
  submitting,
}: {
  brand: PlatformState["brand"];
  email: string;
  error: string;
  notice: string;
  onBack: () => void;
  onResend: () => void;
  submitting: boolean;
}) {
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-background px-5 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,color-mix(in_oklch,var(--primary)_11%,transparent),transparent_34%),radial-gradient(circle_at_85%_85%,color-mix(in_oklch,var(--primary)_7%,transparent),transparent_36%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-5 flex items-center justify-between">
          <Brand
            logoUrl={brand.logoUrl}
            organizationName={brand.organizationName}
            organizationTitle={brand.organizationTitle}
            prominent
          />
          <ThemeToggle />
        </div>
        <Card className="border-border/80 bg-card/95 shadow-[0_24px_80px_-32px_color-mix(in_oklch,var(--foreground)_28%,transparent)] backdrop-blur">
          <CardHeader className="space-y-2 px-7 pt-7">
            <div className="mb-2 grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck />
            </div>
            <CardTitle className="text-2xl tracking-[-0.025em]">Check your email</CardTitle>
            <CardDescription className="leading-6">
              We sent a private verification link to <strong>{email}</strong>. Confirm the address
              to finish signing in. The link expires in one hour.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-7 pb-7">
            {error ? (
              <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-foreground">
                {notice}
              </p>
            ) : null}
            <Button
              className="h-11 w-full rounded-full"
              disabled={submitting}
              onClick={onResend}
              type="button"
            >
              {submitting ? <LoaderCircle className="animate-spin" /> : <MailPlus />}
              Resend verification email
            </Button>
            <Button className="w-full" onClick={onBack} type="button" variant="ghost">
              Return to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Brand({
  organizationName,
  organizationTitle,
  logoUrl,
  prominent = false,
}: {
  organizationName?: string | null;
  organizationTitle?: string | null;
  logoUrl?: string | null;
  prominent?: boolean;
}) {
  return (
    <div className={prominent ? "flex items-center gap-4" : "flex items-center gap-3"}>
      {logoUrl ? (
        <img
          alt={`${organizationName ?? "Organization"} logo`}
          className={
            prominent
              ? "size-16 rounded-2xl border bg-white object-contain p-1.5 shadow-sm"
              : "size-10 rounded-xl border bg-white object-contain p-1 shadow-sm"
          }
          fetchPriority={prominent ? "high" : "auto"}
          loading={prominent ? "eager" : "lazy"}
          src={logoUrl}
        />
      ) : (
        <div
          className={
            prominent
              ? "grid size-16 place-items-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-sm"
              : "grid size-10 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm"
          }
        >
          {organizationName ? initials(organizationName) : "TS"}
        </div>
      )}
      <div>
        <div
          className={`${prominent ? "text-base" : "text-sm"} font-semibold tracking-tight text-foreground`}
        >
          {organizationTitle || "Tsewa"}
        </div>
        <div className={`${prominent ? "text-sm" : "text-xs"} text-muted-foreground`}>
          {organizationName || "School & Care Operations"}
        </div>
      </div>
    </div>
  );
}

function formatSessionRange(session: AcademicSession): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${session.startsOn}T00:00:00Z`))} — ${formatter.format(
    new Date(`${session.endsOn}T00:00:00Z`),
  )}`;
}

function Launchpad({
  onSearchChange,
  platform,
  search,
  settingsTab,
  user,
  view,
}: {
  onSearchChange?: RoutedSearchChange;
  platform: PlatformState;
  search: RoutedAppSearch;
  settingsTab: SettingsTab;
  user: { name: string; email: string; emailVerified: boolean };
  view: AppView;
}) {
  const navigate = useNavigate();
  const [activeSessionId, setActiveSessionId] = useState(
    platform.activeSessionId ?? platform.sessions[0]?.id ?? "",
  );
  const activeOrganization = platform.organizations.find(
    (organization) => organization.id === platform.activeOrganizationId,
  );
  function openView(nextView: AppView, tab?: SettingsTab) {
    if (nextView === "settings") {
      void navigate({ to: "/settings/$tab", params: { tab: tab ?? "general" } });
      return;
    }
    void navigate({ to: legacyViewPath(nextView) });
  }
  const modules: DashboardModule[] = [
    {
      Icon: Users,
      title: "People",
      description: "Personal details, family, placement, and documents",
      view: "people" as const,
      open: true,
    },
    {
      Icon: GraduationCap,
      title: "School",
      description: "Students, classes, marks, and results",
      view: "school" as const,
      open: true,
    },
    {
      Icon: HeartPulse,
      title: "Health",
      description: "Visits, treatment, and health history",
      view: "health" as const,
      open: true,
    },
    {
      Icon: Award,
      title: "Scholarships",
      description: "Awards, progress, sanctions, advances, and reports",
      view: "scholarship" as const,
      open: true,
    },
    {
      Icon: HeartHandshake,
      title: "Sponsorship",
      description: "Sponsors, beneficiary links, remittances, correspondence, and visits",
      view: "sponsorship" as const,
      open: true,
    },
    {
      Icon: BriefcaseBusiness,
      title: "Staff",
      description: "Employment, departments, designations, and contacts",
      view: "staff" as const,
      open: true,
    },
    {
      Icon: FileText,
      title: "Reports and documents",
      description: "Preview and export operational reports",
      view: "reports" as const,
      open: true,
    },
  ];

  if (view === "people") {
    return (
      <PeopleRegistry
        filters={search as PeopleFilters}
        onBack={() => openView("dashboard")}
        onFiltersChange={onSearchChange as ((filters: PeopleFilters) => void) | undefined}
      />
    );
  }

  if (view === "health") {
    return (
      <HealthOperations
        filters={search as HealthFilters}
        onBack={() => openView("dashboard")}
        onFiltersChange={onSearchChange as ((filters: HealthFilters) => void) | undefined}
      />
    );
  }

  if (view === "scholarship") {
    return (
      <ScholarshipOperations
        activeSessionId={activeSessionId}
        filters={search as ScholarshipFilters}
        onBack={() => openView("dashboard")}
        onFiltersChange={onSearchChange as ((filters: ScholarshipFilters) => void) | undefined}
      />
    );
  }

  if (view === "sponsorship") {
    return (
      <SponsorshipOperations
        activeSessionId={activeSessionId}
        filters={search as SponsorshipFilters}
        onBack={() => openView("dashboard")}
        onFiltersChange={onSearchChange as ((filters: SponsorshipFilters) => void) | undefined}
      />
    );
  }

  if (view === "staff") {
    return (
      <StaffOperations
        filters={search as StaffFilters}
        onBack={() => openView("dashboard")}
        onFiltersChange={onSearchChange as ((filters: StaffFilters) => void) | undefined}
      />
    );
  }

  if (view === "reports") {
    return (
      <ReportsCentre
        activeSessionId={activeSessionId}
        filters={search as ReportsFilters}
        onBack={() => openView("dashboard")}
        onFiltersChange={onSearchChange as ((filters: ReportsFilters) => void) | undefined}
        sessions={platform.sessions}
      />
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

  if (view === "school") {
    return (
      <SchoolOperations
        activeSessionId={activeSessionId}
        filters={search as SchoolFilters}
        onBack={() => openView("dashboard")}
        onFiltersChange={onSearchChange as ((filters: SchoolFilters) => void) | undefined}
        onSessionChange={changeSession}
        sessions={platform.sessions}
      />
    );
  }

  return (
    <main className="min-h-svh w-full max-w-none bg-muted/35">
      <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-background/95 px-5 backdrop-blur md:px-8">
        <Brand
          logoUrl={activeOrganization?.logoUrl}
          organizationName={activeOrganization?.name}
          organizationTitle={activeOrganization?.displayTitle}
        />
        <div className="ml-auto flex items-center gap-3">
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
      <div className="border-b bg-background/70 px-5 md:px-8">
        <nav
          aria-label="Primary navigation"
          className="mx-auto flex max-w-7xl gap-1 overflow-x-auto py-2"
        >
          <Button
            onClick={() => openView("dashboard")}
            size="sm"
            variant={view === "dashboard" ? "secondary" : "ghost"}
          >
            <LayoutDashboard /> Dashboard
          </Button>
          {modules
            .filter((module) => module.open)
            .map(({ Icon, title, view: moduleView }) => (
              <Button key={title} onClick={() => openView(moduleView)} size="sm" variant="ghost">
                <Icon /> {title}
              </Button>
            ))}
          <Button
            className="ml-auto"
            onClick={() => openView("settings", settingsTab)}
            size="sm"
            variant={view === "settings" ? "secondary" : "ghost"}
          >
            <Settings /> Settings
          </Button>
        </nav>
      </div>
      {view === "settings" ? (
        <SettingsWorkspace
          activeTab={settingsTab}
          billingEnabled={platform.deployment.capabilities.requiresBilling}
          onTabChange={(tab) => openView("settings", tab)}
          search={search}
          user={user}
        />
      ) : (
        <Dashboard
          activeSessionId={activeSessionId}
          modules={modules}
          onOpen={openView}
          userName={user.name}
        />
      )}
    </main>
  );
}

function Dashboard({
  activeSessionId,
  modules,
  onOpen,
  userName,
}: {
  activeSessionId: string;
  modules: DashboardModule[];
  onOpen: (view: AppView, tab?: SettingsTab) => void;
  userName: string;
}) {
  const [state, setState] = useState<DashboardState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/dashboard?sessionId=${encodeURIComponent(activeSessionId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => (response.ok ? ((await response.json()) as DashboardState) : null))
      .then((next) => {
        if (next) setState(next);
      })
      .catch((cause: unknown) => {
        if ((cause as { name?: string }).name !== "AbortError") setState(null);
      });
    return () => controller.abort();
  }, [activeSessionId]);

  const metricCards = [
    {
      key: "people" as const,
      label: "Active people",
      detail: "across the organisation",
      Icon: Users,
      view: "people" as const,
    },
    {
      key: "school" as const,
      label: "Current students",
      detail: state ? `in ${state.session.name}` : "in this session",
      Icon: GraduationCap,
      view: "school" as const,
    },
    {
      key: "scholarships" as const,
      label: "Active scholarships",
      detail: "requiring ongoing oversight",
      Icon: Award,
      view: "scholarship" as const,
    },
    {
      key: "sponsorships" as const,
      label: "Sponsorship links",
      detail: state ? `in ${state.session.name}` : "in this session",
      Icon: HeartHandshake,
      view: "sponsorship" as const,
    },
    {
      key: "health" as const,
      label: "Health visits",
      detail: "during the last 30 days",
      Icon: HeartPulse,
      view: "health" as const,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-5 py-9 md:px-8 md:py-12">
      <div className="grid gap-7 lg:grid-cols-[1fr_340px] lg:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Dashboard</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-[-0.045em] md:text-5xl">
            Good to see you, {userName.split(" ")[0]}.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
            A live view of the people and programmes your organisation is responsible for.
          </p>
        </div>
        <Card className="border-primary/20 bg-primary text-primary-foreground shadow-none">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">
              Academic session
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
              {state?.session.name ?? "Loading…"}
            </p>
            {state ? (
              <p className="mt-1 text-sm opacity-75">
                {formatShortDate(state.session.startsOn)} – {formatShortDate(state.session.endsOn)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <section className="mt-9" aria-labelledby="dashboard-overview">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              At a glance
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]" id="dashboard-overview">
              Organisation overview
            </h2>
          </div>
          <button
            className="text-sm font-medium text-primary hover:underline"
            onClick={() => onOpen("settings", "audit")}
            type="button"
          >
            View audit trail
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metricCards.map(({ key, label, detail, Icon, view }) => {
            const metric = state?.metrics[key];
            if (state && !metric) return null;
            return (
              <button
                className="group rounded-2xl border bg-card p-4 text-left shadow-xs transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                key={key}
                onClick={() => onOpen(view)}
                type="button"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4.5" />
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-5 text-3xl font-semibold tracking-[-0.04em]">
                  {metric ? metric.value.toLocaleString() : "—"}
                </p>
                <p className="mt-1 text-sm font-medium">{label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)]">
        <section className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Work areas
          </p>
          <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
            {modules
              .filter((module) => module.open)
              .map(({ Icon, title, description, view }) => (
                <button
                  className="group min-w-0 w-full overflow-hidden whitespace-normal rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/40"
                  key={title}
                  onClick={() => onOpen(view)}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
          </div>
        </section>

        <section className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Recent activity
            </p>
            <History className="size-4 text-muted-foreground" />
          </div>
          <Card className="mt-3">
            <CardContent className="divide-y p-0">
              {state?.activity.length ? (
                state.activity.slice(0, 6).map((event) => (
                  <div className="flex gap-3 px-4 py-3.5" key={event.id}>
                    <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {formatAuditAction(event.action)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {event.actorName ?? "System"} · {formatDateTime(event.occurredAt)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {state ? "No audit activity is available." : "Loading activity…"}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function SettingsWorkspace({
  activeTab,
  billingEnabled,
  onTabChange,
  search,
  user,
}: {
  activeTab: SettingsTab;
  billingEnabled: boolean;
  onTabChange: (tab: SettingsTab) => void;
  search: RoutedAppSearch;
  user: { name: string; email: string; emailVerified: boolean };
}) {
  const tabs: Array<{ key: SettingsTab; label: string; description: string; Icon: LucideIcon }> = [
    { key: "general", label: "General", description: "Organisation profile", Icon: Building2 },
    {
      key: "sessions",
      label: "Academic years",
      description: "Sessions and dates",
      Icon: CalendarDays,
    },
    { key: "members", label: "Members", description: "People and invitations", Icon: Users },
    { key: "roles", label: "Roles", description: "Access control", Icon: ShieldCheck },
    ...(billingEnabled
      ? ([
          { key: "billing", label: "Billing", description: "Plan and invoices", Icon: CreditCard },
        ] as const)
      : []),
    { key: "security", label: "Security", description: "Account and password", Icon: LockKeyhole },
    { key: "audit", label: "Audit", description: "Activity and policy", Icon: History },
  ];
  const selectedTab = activeTab === "billing" && !billingEnabled ? "general" : activeTab;

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-5 py-9 md:px-8 md:py-12 lg:grid-cols-[240px_1fr]">
      <aside>
        <p className="text-sm font-medium text-primary">Settings</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">Organisation</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Identity, access, member accounts, and oversight.
        </p>
        <nav aria-label="Settings" className="mt-6 space-y-1">
          {tabs.map(({ key, label, description, Icon }) => (
            <button
              aria-current={selectedTab === key ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                selectedTab === key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
              key={key}
              onClick={() => onTabChange(key)}
              type="button"
            >
              <Icon className="size-4.5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{label}</span>
                <span
                  className={`block truncate text-xs ${
                    selectedTab === key ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {description}
                </span>
              </span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        {selectedTab === "billing" ? (
          <BillingSettings />
        ) : selectedTab === "security" ? (
          <AccountSettings user={user} />
        ) : selectedTab === "sessions" ? (
          <AcademicSessionSettings />
        ) : (
          <AdministrationPanel activeTab={selectedTab} search={search} />
        )}
      </div>
    </div>
  );
}

function AdministrationPanel({
  activeTab,
  search,
}: {
  activeTab: Exclude<SettingsTab, "billing" | "security" | "sessions">;
  search: RoutedAppSearch;
}) {
  const [state, setState] = useState<OrganizationState | null>(null);
  const [name, setName] = useState("");
  const [displayTitle, setDisplayTitle] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("");
  const [locale, setLocale] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteGroup, setInviteGroup] = useState<"admin" | "staff" | "viewer">("admin");
  const [busy, setBusy] = useState("");
  const [pendingMemberGroups, setPendingMemberGroups] = useState<Set<string>>(() => new Set());
  const [pendingAccessGroups, setPendingAccessGroups] = useState<Set<AccessGroup>>(() => new Set());

  async function refresh() {
    const response = await fetch("/api/organization");
    if (!response.ok) return;
    const next = (await response.json()) as OrganizationState;
    setState(next);
    setName(next.organization.name);
    setDisplayTitle(next.organization.displayTitle ?? "");
    setLogoUrl(next.organization.logoUrl);
    setTimezone(next.organization.timezone);
    setLocale(next.organization.locale);
  }

  useEffect(() => {
    void refresh();
  }, []);

  function startRequest(label: string) {
    setBusy(label);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startRequest("settings");
    const response = await fetch("/api/organization", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, displayTitle: displayTitle || null, timezone, locale }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) toast.error(payload.error ?? "Settings could not be saved.");
    else {
      toast.success("Organization settings saved.");
      await refresh();
    }
    setBusy("");
  }

  async function uploadLogo(file: File) {
    startRequest("logo");
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/organization/logo", { method: "POST", body: form });
    const payload = (await response.json()) as { error?: string; logoUrl?: string };
    if (!response.ok) toast.error(payload.error ?? "The logo could not be uploaded.");
    else {
      setLogoUrl(payload.logoUrl ?? null);
      toast.success("Organisation logo updated.");
      await refresh();
    }
    setBusy("");
  }

  async function removeLogo() {
    startRequest("logo-remove");
    const response = await fetch("/api/organization/logo", { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) toast.error(payload.error ?? "The logo could not be removed.");
    else {
      setLogoUrl(null);
      toast.success("Organisation logo removed.");
      await refresh();
    }
    setBusy("");
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startRequest("invite");
    const response = await fetch("/api/organization/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, group: inviteGroup }),
    });
    const payload = (await response.json()) as {
      error?: string;
      delivery?: { status: "sent" | "failed" };
    };
    if (!response.ok) toast.error(payload.error ?? "Invitation could not be created.");
    else {
      if (payload.delivery?.status === "sent") {
        toast.success("Invitation created and emailed.");
      } else {
        toast.warning("Invitation created, but email delivery failed. Use Resend to try again.");
      }
      setInviteEmail("");
      await refresh();
    }
    setBusy("");
  }

  async function changeGroup(memberId: string, group: "admin" | "staff" | "viewer") {
    const previousGroup = state?.members.find((member) => member.id === memberId)?.group;
    if (!previousGroup || previousGroup === group) return;

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
        toast.error(payload.error ?? "The access group could not be changed.");
        return;
      }
      toast.success("Member access group updated.");
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
      toast.error("The access group could not be changed.");
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
    if (!response.ok) toast.error(payload.error ?? "Ownership could not be transferred.");
    else {
      toast.success(`Ownership transferred to ${memberName}.`);
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
    if (!response.ok) toast.error(payload.error ?? "Invitation could not be revoked.");
    else {
      toast.success("Invitation revoked.");
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
      delivery?: { status: "sent" | "failed" };
    };
    if (!response.ok) toast.error(payload.error ?? "Invitation could not be resent.");
    else {
      if (payload.delivery?.status === "sent") {
        toast.success("A fresh invitation was emailed. The old link no longer works.");
      } else {
        toast.error("Email delivery failed. Wait a minute, then use Resend to try again.");
      }
      await refresh();
    }
    setBusy("");
  }

  async function saveGroupRoles(group: Exclude<AccessGroup, "owner">, roleKeys: AccessRole[]) {
    const previousRoleKeys = state?.accessModel.groups.find((item) => item.key === group)?.roleKeys;
    if (!previousRoleKeys) return;

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
        toast.error(payload.error ?? "Group roles could not be saved.");
        return;
      }
      toast.success(`${groupLabel(group)} access updated.`);
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
      toast.error("Group roles could not be saved.");
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

  if (activeTab === "audit") {
    return (
      <AuditSettings
        canRead={state.currentMember.permissions.includes("audit.read")}
        search={search}
      />
    );
  }

  const sectionCopy = {
    general: {
      eyebrow: "General",
      title: "Organisation profile",
      description: "Control the identity and regional defaults shown throughout Tsewa.",
    },
    members: {
      eyebrow: "Members",
      title: "People and invitations",
      description: "Manage who can sign in and which access group they belong to.",
    },
    roles: {
      eyebrow: "Roles",
      title: "Access control",
      description: "Define the functional roles granted to each organisation access group.",
    },
  }[activeTab];

  return (
    <section id="administration">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{sectionCopy.eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">{sectionCopy.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{sectionCopy.description}</p>
        </div>
        <Badge className="w-fit gap-1.5 rounded-full" variant="outline">
          {isOwner ? <Crown className="size-3.5" /> : <UserCog className="size-3.5" />}
          {groupLabel(state.currentMember.group)}
        </Badge>
      </div>

      <div className="mt-6 grid gap-5">
        {activeTab === "general" ? (
          <Card>
            <CardHeader>
              <div className="mb-2 grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </div>
              <CardTitle>Organisation profile</CardTitle>
              <CardDescription>These details are shown throughout Tsewa.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={saveSettings}>
                <div className="flex flex-col gap-4 rounded-2xl border bg-muted/20 p-4 sm:flex-row sm:items-center">
                  {logoUrl ? (
                    <img
                      alt="Organisation logo"
                      className="size-20 rounded-2xl border bg-white object-contain p-2"
                      src={logoUrl}
                    />
                  ) : (
                    <div className="grid size-20 place-items-center rounded-2xl border border-dashed bg-background text-2xl font-semibold text-muted-foreground">
                      {initials(name || "Organisation")}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Logo</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      JPEG, PNG, or WebP. Keep the file under 2 MB.
                    </p>
                    {canManageSettings ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button asChild disabled={busy === "logo"} size="sm" variant="secondary">
                          <label>
                            {busy === "logo" ? (
                              <LoaderCircle className="animate-spin" />
                            ) : (
                              <Building2 />
                            )}
                            {logoUrl ? "Replace logo" : "Upload logo"}
                            <input
                              accept="image/jpeg,image/png,image/webp"
                              className="sr-only"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void uploadLogo(file);
                                event.target.value = "";
                              }}
                              type="file"
                            />
                          </label>
                        </Button>
                        {logoUrl ? (
                          <Button
                            disabled={busy === "logo-remove"}
                            onClick={() => void removeLogo()}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <X /> Remove
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-name">Organisation name</Label>
                  <Input
                    disabled={!canManageSettings}
                    id="organization-name"
                    onChange={(event) => setName(event.target.value)}
                    value={name}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization-title">Application title</Label>
                  <Input
                    disabled={!canManageSettings}
                    id="organization-title"
                    maxLength={120}
                    onChange={(event) => setDisplayTitle(event.target.value)}
                    placeholder="Tsewa"
                    value={displayTitle}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Shown beside your logo. Leave blank to use Tsewa.
                  </p>
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
        ) : null}

        {activeTab === "members" ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Members</CardTitle>
                  <CardDescription className="mt-1.5">
                    {state.members.length} active{" "}
                    {state.members.length === 1 ? "member" : "members"}
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
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                        <Badge
                          className={
                            member.emailVerified
                              ? "gap-1 border-primary/20 bg-primary/10 text-primary"
                              : "border-border bg-muted text-muted-foreground"
                          }
                          variant="outline"
                        >
                          {member.emailVerified ? <Check className="size-3" /> : null}
                          {member.emailVerified ? "Verified" : "Not verified"}
                        </Badge>
                      </div>
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
        ) : null}
      </div>

      {activeTab === "roles" ? (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>Access groups and functional roles</CardTitle>
            <CardDescription>
              Every member belongs to one access group. A group receives explicit permissions
              through its functional roles; owner always retains every role.
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
                            void saveGroupRoles(
                              group.key as Exclude<AccessGroup, "owner">,
                              nextRoles,
                            )
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
      ) : null}
    </section>
  );
}

type SessionSettingsState = {
  sessions: Array<AcademicSession & { isActive: boolean }>;
  capabilities: { manage: boolean };
};

function AcademicSessionSettings() {
  const [state, setState] = useState<SessionSettingsState | null>(null);
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [busy, setBusy] = useState("");

  async function refresh(resetDraft = false) {
    const response = await fetch("/api/organization/sessions");
    if (!response.ok) return;
    const next = (await response.json()) as SessionSettingsState;
    setState(next);
    if (resetDraft || !name) {
      const latestYear = next.sessions.reduce(
        (maximum, session) => Math.max(maximum, Number(session.startsOn.slice(0, 4)) || 0),
        new Date().getFullYear() - 1,
      );
      const nextYear = latestYear + 1;
      setName(`${nextYear}–${String(nextYear + 1).slice(-2)}`);
      setStartsOn(`${nextYear}-04-01`);
      setEndsOn(`${nextYear + 1}-03-31`);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    const response = await fetch("/api/organization/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, startsOn, endsOn, isActive: true }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) toast.error(payload.error ?? "The academic year could not be created.");
    else {
      toast.success(`${name} is ready to use.`);
      await refresh(true);
    }
    setBusy("");
  }

  async function toggleSession(session: AcademicSession & { isActive: boolean }) {
    setBusy(session.id);
    const response = await fetch(`/api/organization/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: session.name,
        startsOn: session.startsOn,
        endsOn: session.endsOn,
        isActive: !session.isActive,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) toast.error(payload.error ?? "The academic year could not be updated.");
    else {
      toast.success(`${session.name} ${session.isActive ? "archived" : "activated"}.`);
      await refresh();
    }
    setBusy("");
  }

  return (
    <section>
      <p className="text-sm font-medium text-primary">Academic years</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Sessions and dates</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Create the next session before enrolment and results work begins. Existing session data is
        never copied or deleted automatically.
      </p>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Academic year history</CardTitle>
            <CardDescription>
              Active years are available in the global session picker.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {state?.sessions.map((session) => (
              <div
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
                key={session.id}
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <CalendarDays className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{session.name}</p>
                    <Badge variant={session.isActive ? "default" : "secondary"}>
                      {session.isActive ? "Active" : "Archived"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatShortDate(session.startsOn)} – {formatShortDate(session.endsOn)}
                  </p>
                </div>
                {state.capabilities.manage ? (
                  <Button
                    disabled={busy === session.id}
                    onClick={() => void toggleSession(session)}
                    size="sm"
                    variant="outline"
                  >
                    {busy === session.id ? <LoaderCircle className="animate-spin" /> : null}
                    {session.isActive ? "Archive" : "Activate"}
                  </Button>
                ) : null}
              </div>
            )) ?? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                Loading academic years…
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="size-5" />
            </div>
            <CardTitle>Create the next year</CardTitle>
            <CardDescription>
              For example, create 2027–28 before 1 April 2027 and then select it from the header.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={createSession}>
              <div className="space-y-2">
                <Label htmlFor="session-name">Session name</Label>
                <Input
                  disabled={!state?.capabilities.manage}
                  id="session-name"
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="session-start">Starts on</Label>
                  <Input
                    disabled={!state?.capabilities.manage}
                    id="session-start"
                    onChange={(event) => setStartsOn(event.target.value)}
                    required
                    type="date"
                    value={startsOn}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session-end">Ends on</Label>
                  <Input
                    disabled={!state?.capabilities.manage}
                    id="session-end"
                    onChange={(event) => setEndsOn(event.target.value)}
                    required
                    type="date"
                    value={endsOn}
                  />
                </div>
              </div>
              <Button disabled={!state?.capabilities.manage || busy === "create"} type="submit">
                {busy === "create" ? <LoaderCircle className="animate-spin" /> : <CalendarDays />}
                Create academic year
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

type AuditState = {
  events: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    metadataJson: string | null;
    occurredAt: string;
    actorName: string | null;
    actorEmail: string | null;
  }>;
  actions: string[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

function AuditSettings({ canRead, search }: { canRead: boolean; search: RoutedAppSearch }) {
  const navigate = useNavigate();
  const query = search.auditQ ?? "";
  const action = search.auditAction ?? "all";
  const page = search.auditPage ?? 1;
  const [state, setState] = useState<AuditState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: query, action, page: String(page), pageSize: "25" });
      void fetch(`/api/organization/audit?${params}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("The audit trail could not be loaded.");
          return response.json() as Promise<AuditState>;
        })
        .then(setState)
        .catch((cause: unknown) => {
          if ((cause as { name?: string }).name !== "AbortError") {
            setError(
              cause instanceof Error ? cause.message : "The audit trail could not be loaded.",
            );
          }
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [action, canRead, page, query]);

  function updateFilters(next: { q?: string; action?: string; page?: number }) {
    void navigate({
      replace: true,
      to: "/settings/$tab",
      params: { tab: "audit" },
      search: {
        auditQ: next.q ?? search.auditQ,
        auditAction: next.action ?? search.auditAction,
        auditPage: next.page ?? search.auditPage,
      },
    });
  }

  if (!canRead) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <LockKeyhole className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 font-semibold">Audit access is restricted</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your role does not include permission to view organisation audit history.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section>
      <div>
        <p className="text-sm font-medium text-primary">Audit</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Activity and policy</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Review material changes across the organisation. Audit recording cannot be disabled.
        </p>
      </div>

      <Card className="mt-6 border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Mandatory audit policy</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Sign-in, membership, access, profile, and operational changes are recorded with an
              actor and timestamp. Retention and export controls will be added only after the
              organisation approves a formal policy.
            </p>
          </div>
          <Badge className="w-fit rounded-full" variant="outline">
            Always on
          </Badge>
        </CardContent>
      </Card>

      <Card className="mt-5 overflow-hidden">
        <div className="grid gap-3 border-b bg-muted/20 p-4 md:grid-cols-[1fr_240px]">
          <div className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search audit activity"
              className="pl-10"
              onChange={(event) => updateFilters({ q: event.target.value, page: 1 })}
              placeholder="Search action, record, or actor"
              value={query}
            />
          </div>
          <Select
            onValueChange={(value) => updateFilters({ action: value, page: 1 })}
            value={action}
          >
            <SelectTrigger className="w-full rounded-full">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {state?.actions.map((item) => (
                <SelectItem key={item} value={item}>
                  {formatAuditAction(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error ? (
          <div className="m-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <CardContent className="divide-y p-0">
          {state?.events.length ? (
            state.events.map((event) => (
              <div className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto]" key={event.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{formatAuditAction(event.action)}</p>
                    <Badge variant="outline">{event.entityType.replaceAll("_", " ")}</Badge>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {event.actorName ?? "System"}
                    {event.actorEmail ? ` · ${event.actorEmail}` : ""}
                  </p>
                  {event.entityId ? (
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {event.entityId}
                    </p>
                  ) : null}
                </div>
                <time className="text-xs text-muted-foreground" dateTime={event.occurredAt}>
                  {formatDateTime(event.occurredAt)}
                </time>
              </div>
            ))
          ) : (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {state ? "No audit activity matches these filters." : "Loading audit activity…"}
            </div>
          )}
        </CardContent>
        {state && state.pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Page {state.pagination.page} of {state.pagination.totalPages} ·{" "}
              {state.pagination.total.toLocaleString()} events
            </p>
            <div className="flex gap-2">
              <Button
                disabled={page <= 1}
                onClick={() => updateFilters({ page: page - 1 })}
                size="sm"
                variant="outline"
              >
                Previous
              </Button>
              <Button
                disabled={page >= state.pagination.totalPages}
                onClick={() => updateFilters({ page: page + 1 })}
                size="sm"
                variant="outline"
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatAuditAction(value: string): string {
  const words = value.replaceAll(/[._]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
