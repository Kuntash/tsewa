import { createFileRoute } from "@tanstack/react-router";
import { readWriteRoute } from "@/lib/server/file-route";
export const Route = createFileRoute("/api/school-operations/schools")({
  server: { handlers: readWriteRoute },
});
