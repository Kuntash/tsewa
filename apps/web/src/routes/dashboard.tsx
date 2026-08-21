import { createFileRoute } from "@tanstack/react-router";

import { AuthenticatedApp } from "@/routes/index";

export const Route = createFileRoute("/dashboard")({
  component: () => <AuthenticatedApp view="dashboard" />,
});
