import { createFileRoute } from "@tanstack/react-router";

import { deleteRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/people/$personId/siblings/$relatedPersonId")({
  server: { handlers: deleteRoute },
});
