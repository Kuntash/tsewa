import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResetSearch = { token?: string; error?: string };

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): ResetSearch => ({
    token: typeof search.token === "string" ? search.token.slice(0, 512) : undefined,
    error: typeof search.error === "string" ? search.error.slice(0, 120) : undefined,
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const search = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(
    search.error || !search.token
      ? "This reset link is invalid or has expired. Request a new one from sign in."
      : "",
  );
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const invalid = Boolean(search.error) || !search.token;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }
    setSubmitting(true);
    const response = await fetch("/api/auth/reset-password", {
      body: JSON.stringify({ newPassword: password, token: search.token }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setSubmitting(false);
    if (!response.ok) {
      setError("This reset link is invalid or has expired. Request a new one from sign in.");
      return;
    }
    setComplete(true);
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background px-5 py-10">
      <Card className="w-full max-w-md border-border/80 shadow-[0_24px_80px_-32px_color-mix(in_oklch,var(--foreground)_28%,transparent)]">
        <CardHeader className="space-y-2 px-7 pt-7">
          <div className="mb-2 grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
            {complete ? <CheckCircle2 /> : <LockKeyhole />}
          </div>
          <CardTitle className="text-2xl tracking-[-0.025em]">
            {complete ? "Your password is ready" : "Choose a new password"}
          </CardTitle>
          <CardDescription className="leading-6">
            {complete
              ? "Your other sessions have been signed out."
              : "Use at least 10 characters. This link can only be used once."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-7 pb-7">
          {complete ? (
            <Button asChild className="h-11 w-full rounded-full">
              <a href="/">
                Return to sign in <ArrowRight />
              </a>
            </Button>
          ) : (
            <form className="space-y-5" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  autoComplete="new-password"
                  disabled={invalid}
                  id="new-password"
                  minLength={10}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  autoComplete="new-password"
                  disabled={invalid}
                  id="confirm-password"
                  minLength={10}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  type="password"
                  value={confirmation}
                />
              </div>
              {error ? (
                <p
                  className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <Button
                className="h-11 w-full rounded-full"
                disabled={invalid || submitting}
                type="submit"
              >
                {submitting ? "Saving…" : "Save new password"} <ArrowRight />
              </Button>
              {invalid ? (
                <a className="block text-center text-xs text-muted-foreground underline" href="/">
                  Request a new link
                </a>
              ) : null}
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
