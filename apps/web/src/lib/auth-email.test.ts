import { describe, expect, it } from "vitest";

import { buildEmailVerification, buildPasswordResetEmail } from "./auth-email";

describe("authentication email copy", () => {
  it("builds a verification email with an escaped link and one-hour expiry guidance", () => {
    const result = buildEmailVerification({
      email: "owner@example.org",
      name: "Tashi <Admin>",
      url: "https://ths.kunga.dev/api/auth/verify-email?token=one&callbackURL=/dashboard",
    });

    expect(result.subject).toBe("Verify your Tsewa email");
    expect(result.text).toContain("The link expires in one hour.");
    expect(result.html).toContain("Tashi &lt;Admin&gt;");
    expect(result.html).toContain("token=one&amp;callbackURL=/dashboard");
  });

  it("keeps password recovery copy distinct from email verification", () => {
    const result = buildPasswordResetEmail({
      email: "owner@example.org",
      name: "Tashi",
      url: "https://ths.kunga.dev/reset-password",
    });

    expect(result.subject).toBe("Reset your Tsewa password");
    expect(result.text).toContain("Reset password:");
  });
});
