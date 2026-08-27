import { describe, expect, it } from "vitest";

import { getDeploymentConfig, publicAppOrigin } from "./deployment";

describe("deployment policy", () => {
  it("accepts a branded self-hosted organization", () => {
    const deployment = getDeploymentConfig({
      APP_NAME: "Tsewa",
      DEFAULT_LOCALE: "en-IN",
      DEFAULT_ORGANIZATION_NAME: "Tibetan Homes Foundation",
      DEFAULT_ORGANIZATION_SLUG: "tibetan-homes-foundation",
      DEFAULT_ORGANIZATION_TITLE: "THS School & Care Operations",
      DEFAULT_TIMEZONE: "Asia/Kolkata",
      DEPLOYMENT_MODE: "self-hosted",
      PUBLIC_APP_URL: "https://ths.kunga.dev",
    });

    expect(deployment.defaultOrganization?.name).toBe("Tibetan Homes Foundation");
    expect(deployment.capabilities.allowsInitialOwnerBootstrap).toBe(true);
    expect(deployment.capabilities.requiresBilling).toBe(false);
  });

  it("uses the request origin for a one-click self-hosted installation", () => {
    const deployment = getDeploymentConfig({
      DEFAULT_ORGANIZATION_NAME: "Example School",
      DEFAULT_ORGANIZATION_SLUG: "example-school",
      DEPLOYMENT_MODE: "self-hosted",
    });

    expect(publicAppOrigin(deployment, new Request("https://example.workers.dev/sign-in"))).toBe(
      "https://example.workers.dev",
    );
  });

  it("requires a canonical origin for hosted SaaS", () => {
    expect(() => getDeploymentConfig({ DEPLOYMENT_MODE: "hosted" })).toThrow(
      "PUBLIC_APP_URL is required in hosted mode",
    );
  });

  it("opens verified account and organization onboarding in hosted mode", () => {
    const deployment = getDeploymentConfig({
      DEPLOYMENT_MODE: "hosted",
      PUBLIC_APP_URL: "https://app.gettsewa.com",
    });

    expect(deployment.capabilities.allowsInitialOwnerBootstrap).toBe(false);
    expect(deployment.capabilities.allowsPublicSignup).toBe(true);
    expect(deployment.capabilities.requiresBilling).toBe(true);
    expect(deployment.capabilities.requiresEmailVerification).toBe(true);
    expect(deployment.capabilities.supportsMultipleOrganizations).toBe(true);
  });

  it("rejects organization-specific defaults in hosted mode", () => {
    expect(() =>
      getDeploymentConfig({
        DEFAULT_ORGANIZATION_NAME: "Embedded School",
        DEPLOYMENT_MODE: "hosted",
        PUBLIC_APP_URL: "https://app.gettsewa.com",
      }),
    ).toThrow("only valid in self-hosted mode");
  });

  it("rejects insecure public origins outside local development", () => {
    expect(() =>
      getDeploymentConfig({
        DEFAULT_ORGANIZATION_NAME: "Example School",
        DEFAULT_ORGANIZATION_SLUG: "example-school",
        DEPLOYMENT_MODE: "self-hosted",
        PUBLIC_APP_URL: "http://school.example.com",
      }),
    ).toThrow("PUBLIC_APP_URL must use HTTPS");
  });
});
