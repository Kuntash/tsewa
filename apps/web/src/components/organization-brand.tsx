import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type OrganizationBrand = { name: string; logoUrl: string | null };

type PlatformBrandResponse = {
  activeOrganizationId?: string | null;
  organizations?: Array<{ id: string; name: string; logoUrl: string | null }>;
};

// Every printed page asks for the same brand, so it is fetched once per visit.
let brandRequest: Promise<OrganizationBrand | null> | null = null;

function loadOrganizationBrand() {
  brandRequest ??= fetch("/api/platform")
    .then((response) => (response.ok ? (response.json() as Promise<PlatformBrandResponse>) : null))
    .then((platform) => {
      const organization = platform?.organizations?.find(
        (item) => item.id === platform.activeOrganizationId,
      );
      return organization ? { name: organization.name, logoUrl: organization.logoUrl } : null;
    })
    .catch(() => {
      brandRequest = null;
      return null;
    });
  return brandRequest;
}

export function useOrganizationBrand(): OrganizationBrand | null {
  const [brand, setBrand] = useState<OrganizationBrand | null>(null);
  useEffect(() => {
    let current = true;
    void loadOrganizationBrand().then((next) => {
      if (current) setBrand(next);
    });
    return () => {
      current = false;
    };
  }, []);
  return brand;
}

// The organisation's own logo for printed pages. Renders nothing when no logo
// has been uploaded, so a page never prints a placeholder.
export function OrganizationLogo({ className }: { className?: string }) {
  const brand = useOrganizationBrand();
  const [failed, setFailed] = useState(false);
  if (!brand?.logoUrl || failed) return null;
  return (
    <img
      alt={`${brand.name} logo`}
      className={cn("organization-logo shrink-0 object-contain", className)}
      loading="eager"
      onError={() => setFailed(true)}
      src={brand.logoUrl}
    />
  );
}

// Logo and organisation name across the top of a report that has no header of
// its own. It exists only on paper.
export function PrintLetterhead() {
  const brand = useOrganizationBrand();
  if (!brand) return null;
  return (
    <div className="print-letterhead">
      <OrganizationLogo className="size-12" />
      <p className="text-base font-semibold tracking-tight">{brand.name}</p>
    </div>
  );
}
