import { createFileRoute } from "@tanstack/react-router";

import { InvitationPage } from "@/routes/index";

export const Route = createFileRoute("/invite/$token")({
  component: InviteRoute,
});

function InviteRoute() {
  const { token } = Route.useParams();
  return <InvitationPage token={token} />;
}
