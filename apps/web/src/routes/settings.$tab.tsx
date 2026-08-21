import { Navigate, createFileRoute } from "@tanstack/react-router";

import { AuthenticatedApp } from "@/routes/index";
import type { RoutedAppSearch, SettingsTab } from "@/routes/index";

const tabs = new Set<SettingsTab>(["general", "sessions", "members", "roles", "security", "audit"]);

export const Route = createFileRoute("/settings/$tab")({
  validateSearch: (search: Record<string, unknown>): RoutedAppSearch => ({
    auditQ: typeof search.auditQ === "string" ? search.auditQ.slice(0, 100) : undefined,
    auditAction:
      typeof search.auditAction === "string" ? search.auditAction.slice(0, 120) : undefined,
    auditPage:
      typeof search.auditPage === "number" && Number.isInteger(search.auditPage)
        ? Math.max(1, search.auditPage)
        : undefined,
  }),
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
