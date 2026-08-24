import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { getRuntimeEnv } from "@/lib/runtime-env";

export default createServerEntry({
  async fetch(request) {
    const response = await handler.fetch(request);
    const deployment = getRuntimeEnv().deployment;
    const headers = new Headers(response.headers);
    headers.set("X-Tsewa-Deployment-Mode", deployment.mode);
    if (deployment.mode === "self-hosted") {
      headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
      if (request.headers.get("accept")?.includes("text/html")) {
        headers.set("Cache-Control", "private, no-store");
      }
    }
    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  },
});
