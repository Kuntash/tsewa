import { createFileRoute } from "@tanstack/react-router";
import { readPutRoute } from "@/lib/server/file-route";
export const Route = createFileRoute("/api/school-operations/schools/$schoolId/assignments")({
  server: { handlers: readPutRoute },
});
