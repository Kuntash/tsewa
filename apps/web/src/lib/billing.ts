import DodoPayments from "dodopayments";

import type { RuntimeEnv } from "./runtime-env";

export type DodoEnvironment = "test_mode" | "live_mode";
export type BillingInterval = "monthly" | "yearly";
export type TsewaBillingStatus = "active" | "canceled" | "complimentary" | "past_due" | "trialing";

type BillingOwner = { id: string; name: string; email: string };

type SubscriptionWebhook = {
  data: {
    cancel_at_next_billing_date: boolean;
    customer: { customer_id: string };
    metadata: Record<string, unknown>;
    next_billing_date: string;
    product_id: string;
    subscription_id: string;
  };
  timestamp: string;
  type: string;
};

const SUBSCRIPTION_EVENTS = new Set([
  "subscription.active",
  "subscription.cancelled",
  "subscription.expired",
  "subscription.failed",
  "subscription.on_hold",
  "subscription.paused",
  "subscription.plan_changed",
  "subscription.renewed",
  "subscription.unpaused",
  "subscription.updated",
]);

export function getBillingConfig(runtime: RuntimeEnv) {
  const environment: DodoEnvironment =
    runtime.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";
  const apiKey = runtime.DODO_PAYMENTS_API_KEY?.trim() ?? "";
  const webhookKey = runtime.DODO_PAYMENTS_WEBHOOK_KEY?.trim() ?? "";
  const monthlyProductId = runtime.DODO_PRODUCT_ID_MONTHLY?.trim() ?? "";
  const yearlyProductId = runtime.DODO_PRODUCT_ID_YEARLY?.trim() ?? "";

  return {
    apiKey,
    environment,
    monthlyProductId,
    webhookKey,
    yearlyProductId,
    checkoutConfigured: Boolean(apiKey && monthlyProductId && yearlyProductId),
    webhookConfigured: Boolean(apiKey && webhookKey && monthlyProductId && yearlyProductId),
  };
}

export async function getOrganizationBilling(input: {
  organizationId: string;
  runtime: RuntimeEnv;
}) {
  const row = await input.runtime.DB.prepare(
    `SELECT plan_key AS planKey, status, trial_ends_at AS trialEndsAt,
            current_period_ends_at AS currentPeriodEndsAt,
            provider_customer_id AS providerCustomerId,
            provider_subscription_id AS providerSubscriptionId,
            billing_interval AS billingInterval,
            cancel_at_period_end AS cancelAtPeriodEnd,
            active_person_limit AS activePersonLimit
     FROM organization_subscription
     WHERE organization_id = ?`,
  )
    .bind(input.organizationId)
    .first<{
      planKey: string;
      status: TsewaBillingStatus;
      trialEndsAt: string | null;
      currentPeriodEndsAt: string | null;
      providerCustomerId: string | null;
      providerSubscriptionId: string | null;
      billingInterval: BillingInterval | null;
      cancelAtPeriodEnd: number;
      activePersonLimit: number;
    }>();

  if (!row) throw new Error("The organisation billing record could not be found.");
  const config = getBillingConfig(input.runtime);
  return {
    planKey: row.planKey,
    status: row.status,
    trialEndsAt: row.trialEndsAt,
    currentPeriodEndsAt: row.currentPeriodEndsAt,
    billingInterval: row.billingInterval,
    cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
    activePersonLimit: row.activePersonLimit,
    checkoutConfigured: config.checkoutConfigured,
    environment: config.environment,
    hasCustomer: Boolean(row.providerCustomerId),
    manageable: hasManageableSubscription(config.checkoutConfigured, row.providerSubscriptionId),
  };
}

export async function createBillingCheckout(input: {
  organizationId: string;
  interval: BillingInterval;
  owner: BillingOwner;
  publicAppUrl: string;
  runtime: RuntimeEnv;
}) {
  const config = getBillingConfig(input.runtime);
  if (!config.checkoutConfigured) throw new BillingConfigurationError();

  const organization = await input.runtime.DB.prepare(
    `SELECT o.name, s.provider_customer_id AS providerCustomerId
     FROM organization o
     JOIN organization_subscription s ON s.organization_id = o.id
     WHERE o.id = ?`,
  )
    .bind(input.organizationId)
    .first<{ name: string; providerCustomerId: string | null }>();
  if (!organization) throw new Error("The organisation billing record could not be found.");

  const client = createDodoClient(config);
  let customerId = organization.providerCustomerId;
  if (!customerId) {
    const customer = await client.customers.create(
      {
        email: input.owner.email,
        name: organization.name,
        metadata: {
          organization_id: input.organizationId,
          owner_user_id: input.owner.id,
          owner_name: input.owner.name,
        },
      },
      { idempotencyKey: `tsewa-customer-${input.organizationId}` },
    );
    customerId = customer.customer_id;
    await input.runtime.DB.prepare(
      `UPDATE organization_subscription
       SET provider_customer_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = ? AND provider_customer_id IS NULL`,
    )
      .bind(customerId, input.organizationId)
      .run();
  }

  const productId = input.interval === "monthly" ? config.monthlyProductId : config.yearlyProductId;
  const billingUrl = `${input.publicAppUrl}/settings/billing`;
  const session = await client.checkoutSessions.create(
    {
      cancel_url: billingUrl,
      customer: { customer_id: customerId },
      metadata: {
        organization_id: input.organizationId,
        billing_interval: input.interval,
      },
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: `${billingUrl}?billing=returned`,
      show_saved_payment_methods: true,
    },
    { idempotencyKey: `tsewa-checkout-${input.organizationId}-${crypto.randomUUID()}` },
  );
  if (!session.checkout_url) throw new Error("Dodo did not return a hosted checkout URL.");

  return { url: session.checkout_url, environment: config.environment };
}

export async function createBillingPortal(input: {
  organizationId: string;
  publicAppUrl: string;
  runtime: RuntimeEnv;
}) {
  const config = getBillingConfig(input.runtime);
  if (!config.checkoutConfigured) throw new BillingConfigurationError();
  const subscription = await input.runtime.DB.prepare(
    `SELECT provider_customer_id AS providerCustomerId,
            provider_subscription_id AS providerSubscriptionId
     FROM organization_subscription
     WHERE organization_id = ?`,
  )
    .bind(input.organizationId)
    .first<{
      providerCustomerId: string | null;
      providerSubscriptionId: string | null;
    }>();
  if (!subscription?.providerCustomerId || !subscription.providerSubscriptionId) {
    throw new BillingPortalUnavailableError();
  }

  const portal = await createDodoClient(config).customers.customerPortal.create(
    subscription.providerCustomerId,
    { return_url: `${input.publicAppUrl}/settings/billing` },
  );
  return { url: portal.link };
}

export async function handleDodoWebhook(request: Request, runtime: RuntimeEnv) {
  if (!runtime.deployment.capabilities.requiresBilling) {
    return new Response(null, { status: 404 });
  }

  const config = getBillingConfig(runtime);
  if (!config.webhookConfigured) {
    return Response.json({ error: "Dodo webhooks are not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  let event: SubscriptionWebhook;
  try {
    event = createDodoClient(config).webhooks.unwrap(rawBody, {
      headers: Object.fromEntries(request.headers),
      key: config.webhookKey,
    }) as unknown as SubscriptionWebhook;
  } catch {
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const eventId = request.headers.get("webhook-id");
  if (!eventId) return Response.json({ error: "Missing webhook ID." }, { status: 400 });
  if (!SUBSCRIPTION_EVENTS.has(event.type)) return Response.json({ received: true });

  const organizationId = stringMetadata(event.data.metadata?.organization_id);
  const allowedProducts = new Set([config.monthlyProductId, config.yearlyProductId]);
  if (!organizationId || !allowedProducts.has(event.data.product_id)) {
    return Response.json(
      { error: "Webhook subscription is not mapped to this app." },
      { status: 400 },
    );
  }
  const exists = await runtime.DB.prepare(
    "SELECT 1 FROM organization_subscription WHERE organization_id = ?",
  )
    .bind(organizationId)
    .first();
  if (!exists) return Response.json({ error: "Unknown organisation." }, { status: 404 });

  const status = billingStatusForDodoEvent(
    event.type,
    event.data.cancel_at_next_billing_date,
    event.data.next_billing_date,
  );
  const interval: BillingInterval =
    event.data.product_id === config.monthlyProductId ? "monthly" : "yearly";
  await runtime.DB.batch([
    runtime.DB.prepare(
      `INSERT OR IGNORE INTO billing_webhook_event
         (id, event_type, provider_subscription_id, event_timestamp)
       VALUES (?, ?, ?, ?)`,
    ).bind(eventId, event.type, event.data.subscription_id, event.timestamp),
    runtime.DB.prepare(
      `UPDATE organization_subscription
       SET status = ?, provider_customer_id = ?, provider_subscription_id = ?,
           current_period_ends_at = ?, provider_event_at = ?, billing_interval = ?,
           cancel_at_period_end = ?, updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = ?
         AND (provider_event_at IS NULL OR datetime(provider_event_at) <= datetime(?))
         AND EXISTS (
           SELECT 1 FROM billing_webhook_event
           WHERE id = ? AND processed_at IS NULL
         )`,
    ).bind(
      status,
      event.data.customer.customer_id,
      event.data.subscription_id,
      event.data.next_billing_date || null,
      event.timestamp,
      interval,
      event.data.cancel_at_next_billing_date ? 1 : 0,
      organizationId,
      event.timestamp,
      eventId,
    ),
    runtime.DB.prepare(
      `UPDATE billing_webhook_event SET processed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND processed_at IS NULL`,
    ).bind(eventId),
  ]);

  return Response.json({ received: true });
}

export function billingStatusForDodoEvent(
  eventType: string,
  cancelAtNextBillingDate = false,
  nextBillingDate?: string,
): TsewaBillingStatus {
  if (
    eventType === "subscription.cancelled" &&
    cancelAtNextBillingDate &&
    nextBillingDate &&
    Date.parse(nextBillingDate) > Date.now()
  ) {
    return "active";
  }
  if (eventType === "subscription.on_hold" || eventType === "subscription.paused") {
    return "past_due";
  }
  if (
    eventType === "subscription.cancelled" ||
    eventType === "subscription.expired" ||
    eventType === "subscription.failed"
  ) {
    return "canceled";
  }
  return "active";
}

export function hasManageableSubscription(
  checkoutConfigured: boolean,
  providerSubscriptionId: string | null | undefined,
) {
  return Boolean(checkoutConfigured && providerSubscriptionId);
}

export function canCreateOrganizationContent(
  status: TsewaBillingStatus,
  trialEndsAt: string | null,
) {
  if (status === "active" || status === "complimentary") return true;
  return (
    status === "trialing" && Boolean(trialEndsAt) && Date.parse(trialEndsAt as string) > Date.now()
  );
}

export async function getActivePersonCreationBlock(input: {
  organizationId: string;
  runtime: RuntimeEnv;
}): Promise<"limit" | "subscription" | null> {
  if (!input.runtime.deployment.capabilities.requiresBilling) return null;
  const entitlement = await input.runtime.DB.prepare(
    `SELECT s.status, s.trial_ends_at AS trialEndsAt,
            s.active_person_limit AS activePersonLimit,
            (SELECT COUNT(*) FROM person p
             WHERE p.organization_id = s.organization_id AND p.status = 'active') AS activePeople
     FROM organization_subscription s
     WHERE s.organization_id = ?`,
  )
    .bind(input.organizationId)
    .first<{
      status: TsewaBillingStatus;
      trialEndsAt: string | null;
      activePersonLimit: number;
      activePeople: number;
    }>();
  if (!entitlement || !canCreateOrganizationContent(entitlement.status, entitlement.trialEndsAt)) {
    return "subscription";
  }
  return Number(entitlement.activePeople) >= Number(entitlement.activePersonLimit) ? "limit" : null;
}

function createDodoClient(config: ReturnType<typeof getBillingConfig>) {
  return new DodoPayments({
    bearerToken: config.apiKey,
    environment: config.environment,
    webhookKey: config.webhookKey || undefined,
  });
}

function stringMetadata(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export class BillingConfigurationError extends Error {}
export class BillingPortalUnavailableError extends Error {}
