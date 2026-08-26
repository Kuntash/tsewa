import { createFileRoute } from "@tanstack/react-router";

import { writeRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/billing/portal")({
  server: { handlers: writeRoute },
});
