import { createFileRoute } from "@tanstack/react-router";

import { readPatchRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/organization")({
  server: { handlers: readPatchRoute },
});
