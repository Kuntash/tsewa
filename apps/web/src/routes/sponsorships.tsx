import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import type { SponsorshipFilters } from "@/components/sponsorship-operations";
import { sponsorshipSearchSchema } from "@/lib/route-search";
import { AuthenticatedApp } from "@/routes/index";

export const Route = createFileRoute("/sponsorships")({
  validateSearch: sponsorshipSearchSchema,
  component: SponsorshipsRoute,
});

function SponsorshipsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onSearchChange = useCallback(
    (next: SponsorshipFilters) =>
      void navigate({
        replace: true,
        search: {
          section: next.section === "sponsors" ? undefined : next.section,
          q: next.q,
          page: next.page === 1 ? undefined : next.page,
        },
      }),
    [navigate],
  );
  return <AuthenticatedApp onSearchChange={onSearchChange} search={search} view="sponsorship" />;
}
