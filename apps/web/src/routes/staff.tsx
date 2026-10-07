import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import type { StaffFilters } from "@/components/staff-operations";
import { staffSearchSchema } from "@/lib/route-search";
import { AuthenticatedApp } from "@/routes/index";

export const Route = createFileRoute("/staff")({
  validateSearch: staffSearchSchema,
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
          designation: next.designation === "all" ? undefined : next.designation,
          category: next.category === "all" ? undefined : next.category,
          gender: next.gender === "all" ? undefined : next.gender,
          page: next.page === 1 ? undefined : next.page,
        },
      }),
    [navigate],
  );
  return <AuthenticatedApp onSearchChange={onSearchChange} search={search} view="staff" />;
}
