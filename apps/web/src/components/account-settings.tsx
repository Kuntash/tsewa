import { Check, LoaderCircle, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type AccountSettingsProps = {
  user: {
    name: string;
    email: string;
    emailVerified: boolean;
  };
};

export function AccountSettings({ user }: AccountSettingsProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentEmail] = useState(user.email);
  const [pendingEmail, setPendingEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function startRequest(label: string) {
    setBusy(label);
    setMessage("");
    setError("");
  }

  async function updateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startRequest("name");
    const result = await authClient.updateUser({ name: name.trim() });
    if (result.error) setError(result.error.message ?? "Your name could not be updated.");
    else setMessage("Your display name was updated.");
    setBusy("");
  }

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startRequest("email");

    const verification = await authClient.signIn.email({
      email: currentEmail,
      password: emailPassword,
    });
    if (verification.error) {
      setError("Your current password is incorrect.");
      setBusy("");
      return;
    }

    const nextEmail = email.trim().toLowerCase();
    const result = await authClient.changeEmail({
      newEmail: nextEmail,
      callbackURL: "/settings/general",
    });
    if (result.error) setError(result.error.message ?? "Your email could not be updated.");
    else {
      setPendingEmail(nextEmail);
      setEmailPassword("");
      setMessage(
        `Verification sent to ${nextEmail}. Your sign-in email remains ${currentEmail} until you confirm the new address.`,
      );
    }
    setBusy("");
  }

  async function resendVerification() {
    startRequest("verification");
    const result = await authClient.sendVerificationEmail({
      email: currentEmail,
      callbackURL: "/settings/general",
    });
    if (result.error) {
      setError(result.error.message ?? "The verification email could not be sent.");
    } else {
      setMessage(`Verification sent to ${currentEmail}.`);
    }
    setBusy("");
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }

    startRequest("password");
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    if (result.error) setError(result.error.message ?? "Your password could not be updated.");
    else {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated. Other signed-in sessions were revoked.");
    }
    setBusy("");
  }

  return (
    <section id="account">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Personal settings</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Your account</h2>
          <p className="mt-2 text-sm text-muted-foreground">Update your sign-in details.</p>
        </div>
        <Badge className="w-fit gap-1.5 rounded-full" variant="outline">
          {user.emailVerified ? (
            <ShieldCheck className="size-3.5" />
          ) : (
            <Mail className="size-3.5" />
          )}
          {user.emailVerified ? "Verified email" : "Email not verified"}
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

      {!user.emailVerified ? (
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>Verify {currentEmail} to secure your account and future email changes.</p>
          <Button
            className="shrink-0"
            disabled={busy === "verification"}
            onClick={() => void resendVerification()}
            size="sm"
            type="button"
            variant="outline"
          >
            {busy === "verification" ? <LoaderCircle className="animate-spin" /> : <Mail />}
            Resend verification
          </Button>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="mb-2 grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <UserRound className="size-5" />
            </div>
            <CardTitle>Name and email</CardTitle>
            <CardDescription>Update the details you use to sign in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="space-y-3" onSubmit={updateName}>
              <div className="space-y-2">
                <Label htmlFor="account-name">Display name</Label>
                <Input
                  autoComplete="name"
                  id="account-name"
                  minLength={2}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </div>
              <Button disabled={busy === "name"} size="sm" type="submit" variant="secondary">
                {busy === "name" ? <LoaderCircle className="animate-spin" /> : <UserRound />}
                Update name
              </Button>
            </form>

            <div className="border-t pt-5">
              <form className="space-y-3" onSubmit={updateEmail}>
                <div className="space-y-2">
                  <Label htmlFor="account-email">Sign-in email</Label>
                  <Input
                    autoComplete="email"
                    id="account-email"
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-current-password">Current password</Label>
                  <Input
                    autoComplete="current-password"
                    id="email-current-password"
                    onChange={(event) => setEmailPassword(event.target.value)}
                    required
                    type="password"
                    value={emailPassword}
                  />
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Confirm with your current password. We will send a private link to the new
                  address, and your current sign-in email remains active until that link is
                  confirmed.
                </p>
                {pendingEmail ? (
                  <p className="text-xs font-medium text-primary">
                    Waiting for confirmation from {pendingEmail}.
                  </p>
                ) : null}
                <Button
                  disabled={busy === "email" || email === currentEmail}
                  size="sm"
                  type="submit"
                >
                  {busy === "email" ? <LoaderCircle className="animate-spin" /> : <Mail />}
                  Change email
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <LockKeyhole className="size-5" />
            </div>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              Use at least ten characters. Other sessions will be signed out.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={updatePassword}>
              <div className="space-y-2">
                <Label htmlFor="password-current">Current password</Label>
                <Input
                  autoComplete="current-password"
                  id="password-current"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  type="password"
                  value={currentPassword}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-new">New password</Label>
                <Input
                  autoComplete="new-password"
                  id="password-new"
                  minLength={10}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  type="password"
                  value={newPassword}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-confirm">Confirm new password</Label>
                <Input
                  autoComplete="new-password"
                  id="password-confirm"
                  minLength={10}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  type="password"
                  value={confirmPassword}
                />
              </div>
              <Button disabled={busy === "password"} type="submit">
                {busy === "password" ? <LoaderCircle className="animate-spin" /> : <LockKeyhole />}
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
