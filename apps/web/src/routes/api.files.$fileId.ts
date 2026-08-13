import { createFileRoute } from "@tanstack/react-router";

import { readRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/files/$fileId")({ server: { handlers: readRoute } });
