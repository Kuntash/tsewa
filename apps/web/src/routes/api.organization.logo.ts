import { createFileRoute } from "@tanstack/react-router";

import { readWriteDeleteRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/organization/logo")({
  server: { handlers: readWriteDeleteRoute },
});
