import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  FileText,
  GraduationCap,
  HeartPulse,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

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
};

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const session = authClient.useSession();
  const [platform, setPlatform] = useState<PlatformState | null>(null);

  useEffect(() => {
    void fetch("/api/platform")
      .then((response) => response.json() as Promise<PlatformState>)
      .then(setPlatform);
  }, []);

  if (session.isPending || !platform) {
    return (
      <div className="grid min-h-svh place-items-center bg-muted/50">
        <LoaderCircle className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  if (session.data?.user) {
    return <Launchpad name={session.data.user.name} />;
  }

  return <AccessScreen platform={platform} />;
}

function AccessScreen({ platform }: { platform: PlatformState }) {
  const [mode, setMode] = useState<"sign-in" | "setup">(platform.needsSetup ? "setup" : "sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "We could not complete that request.");
      setSubmitting(false);
      return;
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
            One calm place for the work that holds a community together.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">
            People, education, care, sponsorship, and administration—connected around a single
            longitudinal record.
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
                {mode === "setup" ? <ShieldCheck /> : <LockKeyhole />}
              </div>
              <CardTitle className="text-2xl tracking-[-0.025em]">
                {mode === "setup" ? "Create the first owner" : "Welcome back"}
              </CardTitle>
              <CardDescription className="leading-6">
                {mode === "setup"
                  ? "This one-time step creates your organization, owner membership, and first academic session."
                  : "Sign in to your organization’s operational console."}
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
                  {mode === "setup" ? "Create workspace" : "Sign in"}
                  {!submitting ? <ArrowRight /> : null}
                </Button>
              </form>
              {platform.needsSetup ? (
                <button
                  className="mt-5 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => setMode(mode === "setup" ? "sign-in" : "setup")}
                  type="button"
                >
                  {mode === "setup" ? "I already have an account" : "Set up this installation"}
                </button>
              ) : null}
            </CardContent>
          </Card>
          <p className="mt-5 text-center text-xs text-muted-foreground">
            Self-hosted on Cloudflare · Your organization owns its data
          </p>
        </section>
      </div>
    </main>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
        TS
      </div>
      <div>
        <div className="text-sm font-semibold tracking-tight text-foreground">Tsewa</div>
        <div className="text-xs text-muted-foreground">Tibetan Homes Foundation</div>
      </div>
    </div>
  );
}

function Launchpad({ name }: { name: string }) {
  const modules = [
    [Users, "People Registry", "Identity, family, placement, and records"],
    [GraduationCap, "School Operations", "Classes, marks, results, and promotion"],
    [HeartPulse, "Dispensary", "Care episodes and health history"],
    [FileText, "Reports & Documents", "Secure files and reproducible reports"],
  ] as const;

  return (
    <main className="min-h-svh w-full max-w-none bg-muted/35">
      <header className="sticky top-0 z-10 flex h-16 items-center border-b bg-background/95 px-5 backdrop-blur md:px-8">
        <Brand />
        <div className="ml-auto flex items-center gap-3">
          <Badge className="hidden rounded-full sm:inline-flex" variant="outline">
            Session 2026–27
          </Badge>
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
        <p className="text-sm font-medium text-primary">Operational console</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] md:text-4xl">
          Welcome back, {name.split(" ")[0]}
        </h1>
        <p className="mt-3 text-muted-foreground">
          Slice 0 is connected. Business modules arrive one vertical slice at a time.
        </p>
        <div className="mt-9 grid gap-4 md:grid-cols-2">
          {modules.map(([Icon, title, description], index) => (
            <Card className={index === 0 ? "border-primary/25" : "opacity-70"} key={title}>
              <CardHeader className="flex-row items-start gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon />
                </div>
                <div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription className="mt-1.5">{description}</CardDescription>
                </div>
                <Badge
                  className="ml-auto rounded-full"
                  variant={index === 0 ? "default" : "secondary"}
                >
                  {index === 0 ? "Next" : "Planned"}
                </Badge>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
