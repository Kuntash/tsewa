import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import type { SchoolFilters } from "@/components/school-operations";
import { schoolSearchSchema } from "@/lib/route-search";
import { AuthenticatedApp } from "@/routes/index";

export const Route = createFileRoute("/school")({
  validateSearch: schoolSearchSchema,
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
          rosterQ: next.rosterQ,
          rosterSchool: next.rosterSchool === "all" ? undefined : next.rosterSchool,
          resultQ: next.resultQ,
          resultSession: next.resultSession,
          resultSchool: next.resultSchool === "all" ? undefined : next.resultSchool,
          resultClass: next.resultClass === "all" ? undefined : next.resultClass,
          resultSubject: next.resultSubject === "all" ? undefined : next.resultSubject,
          resultTerm: next.resultTerm === "all" ? undefined : next.resultTerm,
          resultPage: next.resultPage === 1 ? undefined : next.resultPage,
        },
      }),
    [navigate],
  );
  return <AuthenticatedApp onSearchChange={onSearchChange} search={search} view="school" />;
}
