import { createFileRoute } from "@tanstack/react-router";

import { writeRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/onboarding")({ server: { handlers: writeRoute } });
