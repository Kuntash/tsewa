import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import type { HealthFilters } from "@/components/health-operations";
import { optionalEnum, optionalPage, optionalString } from "@/lib/route-search";
import { AuthenticatedApp } from "@/routes/index";

export const Route = createFileRoute("/health")({
  validateSearch: (search) => ({
    section: optionalEnum(search.section, ["diagnosis", "tb", "advances"] as const),
    q: optionalString(search.q),
    kind: optionalEnum(search.kind, ["child", "elderly", "staff", "other"] as const),
    outcome: optionalString(search.outcome),
    settlement: optionalString(search.settlement),
    page: optionalPage(search.page),
  }),
  component: HealthRoute,
});

function HealthRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onSearchChange = useCallback(
    (next: HealthFilters) =>
      void navigate({
        replace: true,
        search: {
          section: next.section === "diagnosis" ? undefined : next.section,
          q: next.q,
          kind: next.kind === "all" ? undefined : next.kind,
          outcome: next.section === "tb" && next.outcome !== "all" ? next.outcome : undefined,
          settlement:
            next.section === "advances" && next.settlement !== "all" ? next.settlement : undefined,
          page: next.page === 1 ? undefined : next.page,
        },
      }),
    [navigate],
  );
  return <AuthenticatedApp onSearchChange={onSearchChange} search={search} view="health" />;
}
