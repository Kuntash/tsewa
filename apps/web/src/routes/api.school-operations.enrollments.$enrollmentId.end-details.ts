import { createFileRoute } from "@tanstack/react-router";
import { patchRoute } from "@/lib/server/file-route";
export const Route = createFileRoute(
  "/api/school-operations/enrollments/$enrollmentId/end-details",
)({ server: { handlers: patchRoute } });
