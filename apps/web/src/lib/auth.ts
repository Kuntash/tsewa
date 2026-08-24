import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { createDatabase } from "@/db/client";

type AuthOptions = {
  appName?: string;
  database: D1Database;
  secret: string;
  baseURL: string;
  allowSignUp: boolean;
  sendPasswordReset: (input: { email: string; name: string; url: string }) => Promise<void>;
  sendVerificationEmail: (input: { email: string; name: string; url: string }) => Promise<void>;
};

export function createAuth({
  appName = "Tsewa",
  database,
  secret,
  baseURL,
  allowSignUp,
  sendPasswordReset,
  sendVerificationEmail,
}: AuthOptions) {
  return betterAuth({
    appName,
    database: drizzleAdapter(createDatabase(database), { provider: "sqlite" }),
    secret,
    baseURL,
    trustedOrigins: [baseURL],
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowSignUp,
      minPasswordLength: 10,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordReset({ email: user.email, name: user.name, url });
      },
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendOnSignIn: true,
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }, request) => {
        if (request?.headers.get("x-tsewa-invitation")) return;
        await sendVerificationEmail({ email: user.email, name: user.name, url });
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    user: {
      changeEmail: {
        enabled: true,
        updateEmailWithoutVerification: false,
      },
    },
    advanced: {
      cookiePrefix: "tsewa",
    },
    plugins: [tanstackStartCookies()],
  });
}
