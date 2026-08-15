import { createFileRoute } from "@tanstack/react-router";

import { readPatchRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/school-operations/results/$markSheetId")({
  server: { handlers: readPatchRoute },
});
