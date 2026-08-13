import { createFileRoute } from "@tanstack/react-router";

import { patchDeleteRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/people/$personId/files/$fileId")({
  server: { handlers: patchDeleteRoute },
});
