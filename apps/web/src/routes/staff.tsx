import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import type { StaffFilters } from "@/components/staff-operations";
import { optionalEnum, optionalPage, optionalString } from "@/lib/route-search";
import { AuthenticatedApp } from "@/routes/index";

export const Route = createFileRoute("/staff")({
  validateSearch: (search) => ({
    q: optionalString(search.q),
    status: optionalEnum(search.status, ["active", "inactive"] as const),
    department: optionalString(search.department),
    page: optionalPage(search.page),
  }),
  component: StaffRoute,
});

function StaffRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onSearchChange = useCallback(
    (next: StaffFilters) =>
      void navigate({
        replace: true,
        search: {
          q: next.q,
          status: next.status === "all" ? undefined : next.status,
          department: next.department === "all" ? undefined : next.department,
          page: next.page === 1 ? undefined : next.page,
        },
      }),
    [navigate],
  );
  return <AuthenticatedApp onSearchChange={onSearchChange} search={search} view="staff" />;
}
