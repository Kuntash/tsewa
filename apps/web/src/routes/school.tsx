import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import type { SchoolFilters } from "@/components/school-operations";
import { optionalEnum, optionalPage, optionalString } from "@/lib/route-search";
import { AuthenticatedApp } from "@/routes/index";

export const Route = createFileRoute("/school")({
  validateSearch: (search) => ({
    q: optionalString(search.q),
    school: optionalString(search.school),
    class: optionalString(search.class),
    house: optionalString(search.house),
    status: optionalEnum(search.status, [
      "recorded",
      "enrolled",
      "transferred",
      "withdrawn",
      "completed",
    ] as const),
    section: optionalEnum(search.section, [
      "students",
      "schools",
      "rosters",
      "setup",
      "results",
    ] as const),
    page: optionalPage(search.page),
  }),
  component: SchoolRoute,
});

function SchoolRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onSearchChange = useCallback(
    (next: SchoolFilters) =>
      void navigate({
        replace: true,
        search: {
          q: next.q,
          school: next.school === "all" ? undefined : next.school,
          class: next.class === "all" ? undefined : next.class,
          house: next.house === "all" ? undefined : next.house,
          status: next.status === "all" ? undefined : next.status,
          section: next.section === "students" ? undefined : next.section,
          page: next.page === 1 ? undefined : next.page,
        },
      }),
    [navigate],
  );
  return <AuthenticatedApp onSearchChange={onSearchChange} search={search} view="school" />;
}
