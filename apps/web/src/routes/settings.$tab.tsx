import { Navigate, createFileRoute } from "@tanstack/react-router";

import { AuthenticatedApp } from "@/routes/index";
import type { SettingsTab } from "@/routes/index";
import { settingsSearchSchema } from "@/lib/route-search";

const tabs = new Set<SettingsTab>(["general", "sessions", "members", "roles", "security", "audit"]);

export const Route = createFileRoute("/settings/$tab")({
  validateSearch: settingsSearchSchema,
  component: SettingsRoute,
});

function SettingsRoute() {
  const { tab } = Route.useParams();
  const search = Route.useSearch();
  if (!tabs.has(tab as SettingsTab)) {
    return <Navigate params={{ tab: "general" }} replace to="/settings/$tab" />;
  }
  return <AuthenticatedApp search={search} settingsTab={tab as SettingsTab} view="settings" />;
}
