import { createFileRoute } from "@tanstack/react-router";

import { readRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/school-operations/results/report-card")({
  server: { handlers: readRoute },
});
