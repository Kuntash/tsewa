import { createFileRoute } from "@tanstack/react-router";

import { readWriteRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/scholarships")({
  server: { handlers: readWriteRoute },
});
