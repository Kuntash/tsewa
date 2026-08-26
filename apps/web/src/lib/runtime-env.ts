import { env } from "cloudflare:workers";

import { createDatabase } from "@/db/client";
import { getDeploymentConfig } from "@/lib/deployment";

type SecretBindings = {
  BETTER_AUTH_SECRET?: string;
  DODO_PAYMENTS_API_KEY?: string;
  DODO_PAYMENTS_ENVIRONMENT?: string;
  DODO_PAYMENTS_WEBHOOK_KEY?: string;
  DODO_PRODUCT_ID_MONTHLY?: string;
  DODO_PRODUCT_ID_YEARLY?: string;
};

export type RuntimeEnv = Env &
  SecretBindings & {
    BETTER_AUTH_SECRET: string;
    deployment: ReturnType<typeof getDeploymentConfig>;
    ORM: ReturnType<typeof createDatabase>;
  };

export function getRuntimeEnv() {
  const runtime = env as Env & SecretBindings;

  if (!runtime.BETTER_AUTH_SECRET) {
    throw new Error(
      "BETTER_AUTH_SECRET is missing. Add it to .dev.vars locally or with wrangler secret put in production.",
    );
  }

  return {
    ...runtime,
    deployment: getDeploymentConfig(runtime),
    ORM: createDatabase(runtime.DB),
  } as RuntimeEnv;
}
