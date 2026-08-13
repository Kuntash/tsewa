import { createFileRoute } from "@tanstack/react-router";

import { writeRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/people/$personId/files")({
  server: { handlers: writeRoute },
});
