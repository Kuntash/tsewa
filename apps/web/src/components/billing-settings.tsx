import {
  CalendarClock,
  Check,
  CircleDollarSign,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInstant } from "@/lib/date-time";

type BillingState = {
  planKey: string;
  status: "active" | "canceled" | "complimentary" | "past_due" | "trialing";
  trialEndsAt: number | null;
  currentPeriodEndsAt: number | null;
  billingInterval: "monthly" | "yearly" | null;
  cancelAtPeriodEnd: boolean;
  activePersonLimit: number;
  checkoutConfigured: boolean;
  environment: "test_mode" | "live_mode";
  hasCustomer: boolean;
  manageable: boolean;
  canManage: boolean;
  temporal: { locale: string; timeZone: string };
};

const statusCopy: Record<BillingState["status"], { label: string; description: string }> = {
  active: {
    label: "Active",
    description: "Your hosted subscription is active and managed through Dodo Payments.",
  },
  canceled: {
    label: "Ended",
    description: "This subscription has ended. Choose a plan to restore hosted billing.",
  },
  complimentary: {
    label: "Founding access",
    description: "This organisation currently has complimentary hosted access.",
  },
  past_due: {
    label: "Payment attention",
    description: "A renewal needs attention. Open billing to update the payment method.",
  },
  trialing: {
    label: "Trial",
    description: "Explore the complete hosted platform before choosing a billing interval.",
  },
};

export function BillingSettings() {
  const [state, setState] = useState<BillingState | null>(null);
  const [loadingError, setLoadingError] = useState(false);
  const [busy, setBusy] = useState<"monthly" | "yearly" | "portal" | "">("");

  async function refresh() {
    setLoadingError(false);
    const response = await fetch("/api/billing/status");
    if (!response.ok) {
      setLoadingError(true);
      return;
    }
    setState((await response.json()) as BillingState);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function startCheckout(interval: "monthly" | "yearly") {
    setBusy(interval);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const payload = (await response.json()) as { error?: string; url?: string };
      if (!response.ok || !payload.url) {
        toast.error(payload.error ?? "Checkout could not be started.");
        return;
      }
      window.location.assign(payload.url);
    } catch {
      toast.error("Checkout could not be reached. Check your connection and try again.");
    } finally {
      setBusy("");
    }
  }

  async function openPortal() {
    setBusy("portal");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = (await response.json()) as { error?: string; url?: string };
      if (!response.ok || !payload.url) {
        toast.error(payload.error ?? "The billing portal could not be opened.");
        return;
      }
      window.location.assign(payload.url);
    } catch {
      toast.error("The billing portal could not be reached. Try again in a moment.");
    } finally {
      setBusy("");
    }
  }

  if (loadingError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billing is temporarily unavailable</CardTitle>
          <CardDescription>We could not load this organisation’s billing record.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void refresh()} variant="outline">
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!state) {
    return (
      <Card>
        <CardContent className="grid min-h-48 place-items-center">
          <LoaderCircle className="size-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const copy = statusCopy[state.status];
  const trialDays = remainingDays(state.trialEndsAt);
  const periodDate = formatDate(state.currentPeriodEndsAt, state.temporal);

  return (
    <section aria-labelledby="billing-title" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Hosted service</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]" id="billing-title">
            Plan and billing
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            One organisation subscription covers the full team and up to 500 active person records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            className="rounded-full"
            variant={state.status === "past_due" ? "destructive" : "outline"}
          >
            {copy.label}
          </Badge>
          {state.environment === "test_mode" ? (
            <Badge
              className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
              variant="outline"
            >
              Test mode
            </Badge>
          ) : null}
        </div>
      </div>

      <Card className="overflow-hidden border-primary/15">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-primary p-6 text-primary-foreground sm:p-8">
            <div className="grid size-11 place-items-center rounded-full bg-primary-foreground/12">
              <CircleDollarSign className="size-5" />
            </div>
            <p className="mt-7 text-sm font-medium text-primary-foreground/70">Hosted Tsewa</p>
            <h3 className="mt-2 max-w-lg font-serif text-3xl leading-tight tracking-[-0.035em] sm:text-4xl">
              Every person and programme, on one connected record.
            </h3>
            <p className="mt-4 max-w-xl text-sm leading-6 text-primary-foreground/72">
              Product updates, managed infrastructure, standard support, ordinary exports, and
              reasonable team access are included.
            </p>
            <div className="mt-7 grid gap-3 text-sm sm:grid-cols-2">
              {[
                "Up to 500 active people",
                "No per-seat charge",
                "All current work areas",
                "Dodo-hosted invoices and cancellation",
              ].map((feature) => (
                <div className="flex items-center gap-2" key={feature}>
                  <span className="grid size-5 place-items-center rounded-full bg-primary-foreground/12">
                    <Check className="size-3.5" />
                  </span>
                  {feature}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Current access</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.description}</p>
              </div>
              <ShieldCheck className="size-5 shrink-0 text-primary" />
            </div>

            <dl className="mt-6 divide-y rounded-2xl border bg-muted/20 px-4">
              <BillingFact label="Plan" value="Hosted Tsewa" />
              <BillingFact label="Person allowance" value={`${state.activePersonLimit} active`} />
              {state.billingInterval ? (
                <BillingFact label="Billing interval" value={capitalize(state.billingInterval)} />
              ) : null}
              {state.status === "trialing" && trialDays !== null ? (
                <BillingFact
                  label="Trial remaining"
                  value={`${trialDays} day${trialDays === 1 ? "" : "s"}`}
                />
              ) : null}
              {periodDate ? (
                <BillingFact
                  label={state.cancelAtPeriodEnd ? "Access until" : "Next billing date"}
                  value={periodDate}
                />
              ) : null}
            </dl>

            {!state.canManage ? (
              <p className="mt-5 rounded-xl border bg-muted/30 px-4 py-3 text-sm leading-6 text-muted-foreground">
                Only the organisation owner can start checkout or open the customer portal.
              </p>
            ) : state.manageable ? (
              <Button
                className="mt-5 w-full"
                disabled={busy === "portal"}
                onClick={() => void openPortal()}
              >
                {busy === "portal" ? <LoaderCircle className="animate-spin" /> : <ExternalLink />}
                Manage billing
              </Button>
            ) : (
              <div className="mt-5 space-y-3">
                <Button
                  className="h-auto w-full justify-between px-4 py-3"
                  disabled={!state.checkoutConfigured || Boolean(busy)}
                  onClick={() => void startCheckout("monthly")}
                  variant="outline"
                >
                  <span className="text-left">
                    <span className="block font-semibold">Monthly</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      $79 globally · ₹4,900 in India
                    </span>
                  </span>
                  {busy === "monthly" ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <ExternalLink />
                  )}
                </Button>
                <Button
                  className="h-auto w-full justify-between px-4 py-3"
                  disabled={!state.checkoutConfigured || Boolean(busy)}
                  onClick={() => void startCheckout("yearly")}
                >
                  <span className="text-left">
                    <span className="block font-semibold">Yearly</span>
                    <span className="block text-xs font-normal text-primary-foreground/72">
                      $790 globally · ₹49,000 in India
                    </span>
                  </span>
                  {busy === "yearly" ? <LoaderCircle className="animate-spin" /> : <ExternalLink />}
                </Button>
                {!state.checkoutConfigured ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Checkout will open after the hosted Dodo products and webhook are configured.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
              <CalendarClock className="size-4.5" />
            </div>
            <CardTitle className="mt-2 text-lg">Subscription lifecycle</CardTitle>
            <CardDescription className="leading-6">
              Access changes only after a signed Dodo webhook. Returning from checkout never
              activates a subscription by itself.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <div className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="size-4.5" />
            </div>
            <CardTitle className="mt-2 text-lg">Billing stays with the organisation</CardTitle>
            <CardDescription className="leading-6">
              Ownership can transfer without moving the subscription. Dodo’s portal handles payment
              methods, invoices, plan changes, and cancellation.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </section>
  );
}

function BillingFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function remainingDays(value: number | null) {
  if (!value) return null;
  return Math.max(0, Math.ceil((value - Date.now()) / (24 * 60 * 60 * 1000)));
}

function formatDate(value: number | null, temporal: { locale: string; timeZone: string }) {
  if (!value) return null;
  return formatInstant(value, temporal.locale, temporal.timeZone, {
    hour: undefined,
    minute: undefined,
  });
}

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
