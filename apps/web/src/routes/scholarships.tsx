import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import type { ScholarshipFilters } from "@/components/scholarship-operations";
import { scholarshipSearchSchema } from "@/lib/route-search";
import { AuthenticatedApp } from "@/routes/index";

export const Route = createFileRoute("/scholarships")({
  validateSearch: scholarshipSearchSchema,
  component: ScholarshipsRoute,
});

function ScholarshipsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onSearchChange = useCallback(
    (next: ScholarshipFilters) =>
      void navigate({
        replace: true,
        search: {
          q: next.q,
          status: next.status === "all" ? undefined : next.status,
          course: next.course === "all" ? undefined : next.course,
          page: next.page === 1 ? undefined : next.page,
        },
      }),
    [navigate],
  );
  return <AuthenticatedApp onSearchChange={onSearchChange} search={search} view="scholarship" />;
}
