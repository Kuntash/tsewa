import { describe, expect, it } from "vitest";

import {
  billingStatusForDodoEvent,
  canCreateOrganizationContent,
  getBillingConfig,
  handleDodoWebhook,
  hasManageableSubscription,
} from "./billing";
import type { RuntimeEnv } from "./runtime-env";

const emptyRuntime = {} as RuntimeEnv;

describe("Dodo organisation billing", () => {
  it("defaults safely to test mode and remains unavailable without credentials", () => {
    const config = getBillingConfig(emptyRuntime);
    expect(config.environment).toBe("test_mode");
    expect(config.checkoutConfigured).toBe(false);
    expect(config.webhookConfigured).toBe(false);
  });

  it("maps lifecycle events without ending scheduled access early", () => {
    expect(billingStatusForDodoEvent("subscription.active")).toBe("active");
    expect(billingStatusForDodoEvent("subscription.on_hold")).toBe("past_due");
    expect(billingStatusForDodoEvent("subscription.failed")).toBe("canceled");
    expect(billingStatusForDodoEvent("subscription.cancelled", true, "2099-01-01T00:00:00Z")).toBe(
      "active",
    );
  });

  it("recognises a complete test configuration", () => {
    const config = getBillingConfig({
      DODO_PAYMENTS_API_KEY: "dodo_test_key",
      DODO_PAYMENTS_ENVIRONMENT: "test_mode",
      DODO_PAYMENTS_WEBHOOK_KEY: "whsec_test",
      DODO_PRODUCT_ID_MONTHLY: "pdt_monthly",
      DODO_PRODUCT_ID_YEARLY: "pdt_yearly",
    } as RuntimeEnv);
    expect(config.checkoutConfigured).toBe(true);
    expect(config.webhookConfigured).toBe(true);
    expect(config.environment).toBe("test_mode");
  });

  it("does not mistake an abandoned checkout customer for a subscription", () => {
    expect(hasManageableSubscription(true, null)).toBe(false);
    expect(hasManageableSubscription(true, "sub_test")).toBe(true);
    expect(hasManageableSubscription(false, "sub_test")).toBe(false);
  });

  it("does not expose the webhook in self-hosted mode", async () => {
    const response = await handleDodoWebhook(
      new Request("https://school.example.com/api/webhooks/dodo", { method: "POST" }),
      {
        deployment: { capabilities: { requiresBilling: false } },
      } as RuntimeEnv,
    );

    expect(response.status).toBe(404);
  });

  it("allows paid, complimentary, and unexpired trial creation", () => {
    expect(canCreateOrganizationContent("active", null)).toBe(true);
    expect(canCreateOrganizationContent("complimentary", null)).toBe(true);
    expect(canCreateOrganizationContent("trialing", "2099-01-01T00:00:00Z")).toBe(true);
    expect(canCreateOrganizationContent("trialing", "2020-01-01T00:00:00Z")).toBe(false);
    expect(canCreateOrganizationContent("past_due", null)).toBe(false);
    expect(canCreateOrganizationContent("canceled", null)).toBe(false);
  });
});
