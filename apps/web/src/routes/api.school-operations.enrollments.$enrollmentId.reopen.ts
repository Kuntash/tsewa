import { createFileRoute } from "@tanstack/react-router";
import { writeRoute } from "@/lib/server/file-route";
export const Route = createFileRoute("/api/school-operations/enrollments/$enrollmentId/reopen")({
  server: { handlers: writeRoute },
});
