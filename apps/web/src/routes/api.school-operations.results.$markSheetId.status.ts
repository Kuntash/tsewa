import { createFileRoute } from "@tanstack/react-router";

import { writeRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/school-operations/results/$markSheetId/status")({
  server: { handlers: writeRoute },
});
