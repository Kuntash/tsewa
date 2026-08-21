import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import type { ReportsFilters } from "@/components/reports-centre";
import { optionalEnum, optionalString } from "@/lib/route-search";
import { AuthenticatedApp } from "@/routes/index";

export const Route = createFileRoute("/reports")({
  validateSearch: (search) => ({
    domain: optionalEnum(search.domain, ["scholarship", "sponsorship"] as const),
    report: optionalString(search.report),
    session: optionalString(search.session),
    q: optionalString(search.q),
  }),
  component: ReportsRoute,
});

function ReportsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onSearchChange = useCallback(
    (next: ReportsFilters) =>
      void navigate({
        replace: true,
        search: {
          domain: next.domain,
          report: next.report,
          session: next.session,
          q: next.q,
        },
      }),
    [navigate],
  );
  return <AuthenticatedApp onSearchChange={onSearchChange} search={search} view="reports" />;
}
