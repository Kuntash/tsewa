import { createFileRoute } from "@tanstack/react-router";

import { patchRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/people/$personId/family")({
  server: { handlers: patchRoute },
});
