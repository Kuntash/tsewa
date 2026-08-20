import { env } from "cloudflare:workers";

import { createDatabase } from "@/db/client";
import { QueryDatabase } from "@/db/query";

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
    ORM: createDatabase(runtime.DB),
    DATABASE: new QueryDatabase(runtime.DB),
  } as Env & {
    BETTER_AUTH_SECRET: string;
    ORM: ReturnType<typeof createDatabase>;
    DATABASE: QueryDatabase;
  };
}
