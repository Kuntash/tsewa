import { createFileRoute } from "@tanstack/react-router";

import { writeRoute } from "@/lib/server/file-route";

export const Route = createFileRoute("/api/organization/invitations/$invitationId/resend")({
  server: { handlers: writeRoute },
});
