import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import DodoPayments from "dodopayments";

const WEBHOOK_URL = "https://app.gettsewa.com/api/webhooks/dodo";
const WEBHOOK_EVENTS = [
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
];

const variables = {
  ...readDevVariables(".dev.vars"),
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key, value]) => key.startsWith("DODO_") && value),
  ),
};
const apiKey = variables.DODO_PAYMENTS_API_KEY;
if (!apiKey) {
  throw new Error("A test-mode DODO_PAYMENTS_API_KEY is required.");
}

const client = new DodoPayments({ bearerToken: apiKey, environment: "test_mode" });
const brand = await ensureBrand();
const products = [];
for await (const product of client.products.list({ recurring: true })) products.push(product);

const monthly = await ensureProduct({
  amount: 7900,
  indiaAmount: 490000,
  interval: "Month",
  marker: "hosted-monthly",
  name: "Hosted Tsewa — Monthly",
});
const yearly = await ensureProduct({
  amount: 79000,
  indiaAmount: 4900000,
  interval: "Year",
  marker: "hosted-yearly",
  name: "Hosted Tsewa — Yearly",
});

let webhook = null;
for await (const candidate of client.webhooks.list()) {
  if (candidate.url === WEBHOOK_URL) {
    webhook = candidate;
    break;
  }
}

if (webhook) {
  webhook = await client.webhooks.update(webhook.id, {
    description: "Tsewa test subscription lifecycle",
    disabled: false,
    filter_types: WEBHOOK_EVENTS,
    metadata: { app: "tsewa", environment: "test" },
  });
  console.log("Reused the existing Tsewa test webhook.");
} else {
  webhook = await client.webhooks.create({
    description: "Tsewa test subscription lifecycle",
    disabled: false,
    filter_types: WEBHOOK_EVENTS,
    idempotency_key: "tsewa-test-webhook-v1",
    metadata: { app: "tsewa", environment: "test" },
    url: WEBHOOK_URL,
  });
  console.log("Created the Tsewa test webhook.");
}

const webhookSecret = await client.webhooks.retrieveSecret(webhook.id);
const cloudflareSecrets = {
  DODO_PAYMENTS_API_KEY: apiKey,
  DODO_PAYMENTS_ENVIRONMENT: "test_mode",
  DODO_PAYMENTS_WEBHOOK_KEY: webhookSecret.secret,
  DODO_PRODUCT_ID_MONTHLY: monthly.product_id,
  DODO_PRODUCT_ID_YEARLY: yearly.product_id,
};
const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const upload = spawnSync(
  "pnpm",
  [
    "--filter",
    "@tsewa/web",
    "exec",
    "wrangler",
    "secret",
    "bulk",
    "--config",
    "wrangler.hosted.jsonc",
  ],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    input: JSON.stringify(cloudflareSecrets),
  },
);
if (upload.status !== 0) {
  if (upload.stdout) process.stdout.write(upload.stdout);
  if (upload.stderr) process.stderr.write(upload.stderr);
  throw new Error("Could not store the Dodo test configuration in Cloudflare.");
}

console.log("Stored the Dodo test configuration in the hosted Worker.");
console.log(`Brand: ${brand.brand_id}`);
console.log(`Monthly product: ${monthly.product_id}`);
console.log(`Yearly product: ${yearly.product_id}`);
console.log(`Webhook: ${webhook.id}`);

async function ensureBrand() {
  const response = await client.brands.list();
  const existing = response.items.find(
    (candidate) => candidate.name?.trim().toLowerCase() === "tsewa" && !candidate.archived_at,
  );
  if (existing) {
    console.log("Reused the existing Tsewa brand.");
    return existing;
  }
  const created = await client.brands.create({
    description: "Tsewa school and care management subscriptions.",
    name: "Tsewa",
    statement_descriptor: "TSEWA",
    url: "https://gettsewa.com",
  });
  console.log("Created the Tsewa brand.");
  return created;
}

async function ensureProduct({ amount, indiaAmount, interval, marker, name }) {
  const marked = products.find((product) => product.metadata?.tsewa_plan === marker);
  const named = products.find((product) => product.name === name);
  let product = marked ?? named;
  if (product) {
    assertProductConfiguration(product, { amount, interval, name });
    if (product.brand_id !== brand.brand_id) {
      product = await client.products.update(product.product_id, { brand_id: brand.brand_id });
      console.log(`Moved ${name} to the Tsewa brand.`);
    }
    console.log(`Reused ${name}.`);
  } else {
    product = await client.products.create(
      {
        description:
          "One connected operational record for education, care, and community organisations, including up to 500 active people.",
        brand_id: brand.brand_id,
        metadata: { tsewa_plan: marker },
        name,
        price: {
          currency: "USD",
          discount: 0,
          payment_frequency_count: 1,
          payment_frequency_interval: interval,
          price: amount,
          purchasing_power_parity: false,
          subscription_period_count: 1,
          subscription_period_interval: interval,
          type: "recurring_price",
        },
        pricing_mode: "by_country",
        tax_category: "saas",
      },
      { idempotencyKey: `tsewa-${marker}-v1` },
    );
    products.push(product);
    console.log(`Created ${name}.`);
  }

  if (product.pricing_mode !== "by_country") {
    product = await client.products.update(product.product_id, { pricing_mode: "by_country" });
  }
  await ensureIndiaPrice(product.product_id, indiaAmount);
  return product;
}

async function ensureIndiaPrice(productId, amount) {
  const rules = await client.products.localizedPrices.list(productId);
  const existing = rules.items.find(
    (rule) => rule.mode === "by_country" && rule.country_code === "IN" && rule.currency === "INR",
  );
  if (!existing) {
    await client.products.localizedPrices.create(productId, {
      amount,
      country_code: "IN",
      currency: "INR",
    });
    return;
  }
  if (existing.amount !== amount) {
    await client.products.localizedPrices.update(existing.id, { product_id: productId, amount });
  }
}

function assertProductConfiguration(product, expected) {
  const price = product.price_detail;
  const matches =
    product.is_recurring &&
    product.currency === "USD" &&
    product.price === expected.amount &&
    price?.type === "recurring_price" &&
    price.payment_frequency_count === 1 &&
    price.payment_frequency_interval === expected.interval &&
    price.subscription_period_count === 1 &&
    price.subscription_period_interval === expected.interval;
  if (!matches) {
    throw new Error(`${expected.name} exists but does not match the expected billing schedule.`);
  }
}

function readDevVariables(path) {
  if (!existsSync(path)) return {};
  const result = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}
