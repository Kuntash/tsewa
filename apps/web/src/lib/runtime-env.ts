import { env } from "cloudflare:workers";

import { createDatabase } from "@/db/client";
import { getDeploymentConfig } from "@/lib/deployment";

type SecretBindings = {
  BETTER_AUTH_SECRET?: string;
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
  } as Env & {
    BETTER_AUTH_SECRET: string;
    deployment: ReturnType<typeof getDeploymentConfig>;
    ORM: ReturnType<typeof createDatabase>;
  };
}
