import { createFileRoute } from "@tanstack/react-router";
import { patchRoute } from "@/lib/server/file-route";
export const Route = createFileRoute("/api/school-operations/classes/$classId")({
  server: { handlers: patchRoute },
});
