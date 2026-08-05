import { env } from "cloudflare:workers";

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

  return runtime as Env & { BETTER_AUTH_SECRET: string };
}
