import { createFileRoute } from "@tanstack/react-router";
import { readRoute } from "@/lib/server/file-route";
export const Route = createFileRoute("/api/school-operations/results/overview")({
  server: { handlers: readRoute },
});
