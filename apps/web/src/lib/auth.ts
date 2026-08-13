import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { createDatabase } from "@/db/client";

type AuthOptions = {
  database: D1Database;
  secret: string;
  baseURL: string;
  allowSignUp: boolean;
};

export function createAuth({ database, secret, baseURL, allowSignUp }: AuthOptions) {
  return betterAuth({
    appName: "Tsewa",
    database: drizzleAdapter(createDatabase(database), { provider: "sqlite" }),
    secret,
    baseURL,
    trustedOrigins: [baseURL],
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowSignUp,
      minPasswordLength: 10,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    user: {
      changeEmail: {
        enabled: true,
        updateEmailWithoutVerification: true,
      },
    },
    advanced: {
      cookiePrefix: "tsewa",
    },
    plugins: [tanstackStartCookies()],
  });
}
