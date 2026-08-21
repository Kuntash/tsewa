import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import type { PeopleFilters } from "@/components/people-registry";
import { optionalEnum, optionalPage, optionalString } from "@/lib/route-search";
import { AuthenticatedApp } from "@/routes/index";

export const Route = createFileRoute("/people")({
  validateSearch: (search) => ({
    q: optionalString(search.q),
    kind: optionalEnum(search.kind, ["child", "elderly", "staff"] as const),
    status: optionalEnum(search.status, ["active", "inactive"] as const),
    page: optionalPage(search.page),
  }),
  component: PeopleRoute,
});

function PeopleRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onSearchChange = useCallback(
    (next: PeopleFilters) =>
      void navigate({
        replace: true,
        search: {
          q: next.q,
          kind: next.kind === "all" ? undefined : next.kind,
          status: next.status === "all" ? undefined : next.status,
          page: next.page === 1 ? undefined : next.page,
        },
      }),
    [navigate],
  );
  return <AuthenticatedApp onSearchChange={onSearchChange} search={search} view="people" />;
}
