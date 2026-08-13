import { createFileRoute } from "@tanstack/react-router";

import { readRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/people/$personId/sibling-options")({
  server: { handlers: readRoute },
});
