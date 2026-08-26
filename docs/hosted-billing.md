# Hosted Tsewa billing

Hosted Tsewa is billed per organisation, not per user. The launch plan includes up to 500 active
person records and reasonable team access for **US$79 monthly / US$790 yearly**, with fixed India
pricing of **₹4,900 monthly / ₹49,000 yearly**. Self-hosted installations do not load billing routes
or require Dodo credentials.

## Entitlement boundary

`organization_subscription` is the local source for application access state. It belongs to the
organisation so ownership can transfer without moving the subscription. Existing organisations
retain complimentary access during rollout; newly created hosted organisations receive a 30-day
internal trial.

Dodo Payments owns checkout, tax collection, invoices, payment methods, cancellation, and its
customer portal. Tsewa stores only provider IDs, lifecycle state, billing dates, and the active
person allowance.

## Security and lifecycle

- Checkout accepts only the `monthly` or `yearly` application slug and maps it to a secret product
  ID on the server.
- Only the active organisation owner can create checkout or portal sessions.
- The return URL never activates access.
- Signed subscription webhooks are the only path that changes paid entitlement state.
- Webhook IDs are stored for idempotency and provider timestamps prevent older deliveries from
  overwriting newer state.
- A period-end cancellation remains active until Dodo reports the subscription ended.
- Dodo secrets never enter browser bundles and are optional in self-hosted mode.

## Test-mode setup

Put a Dodo test-environment API key in `apps/web/.dev.vars` or the process environment, then run:

```sh
pnpm --filter @tsewa/web billing:setup:test
```

The idempotent setup command:

1. creates or reuses monthly and yearly recurring products;
2. adds fixed INR prices for India using `by_country` localized pricing;
3. registers `https://app.gettsewa.com/api/webhooks/dodo` for subscription lifecycle events;
4. retrieves the signing secret; and
5. stores the API key, webhook key, environment, and product IDs as hosted Worker secrets without
   printing secret values.

Keep `DODO_PAYMENTS_ENVIRONMENT=test_mode` until successful checkout, duplicate and out-of-order
webhook delivery, renewal failure, recovery, period-end cancellation, immediate cancellation,
portal access, and owner transfer have all passed end to end.

## Going live

Test and live Dodo environments have separate keys, products, localized prices, webhooks, and
transactions. After account verification:

1. create or copy both products into live mode and verify their localized India prices;
2. create the live webhook and retrieve its live signing secret;
3. bulk replace all five hosted Worker Dodo secrets together;
4. apply D1 migrations and deploy the exact validated release;
5. make one real low-value purchase and verify the signed lifecycle webhook, portal, invoice, and
   cancellation flow; and
6. monitor failed webhooks and renewals before inviting paying organisations.

Never mix a test-environment key or product ID with `live_mode`.
