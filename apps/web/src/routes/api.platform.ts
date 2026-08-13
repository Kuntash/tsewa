import { createFileRoute } from "@tanstack/react-router";

import { readWriteRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/platform")({ server: { handlers: readWriteRoute } });
