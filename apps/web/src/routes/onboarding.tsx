import { Navigate, createFileRoute } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { HostedOnboarding } from "@/components/hosted-onboarding";
import { authClient } from "@/lib/auth-client";

type OnboardingPlatformState = {
  deployment: { mode: "hosted" | "self-hosted" };
  activeOrganizationId?: string | null;
};

export const Route = createFileRoute("/onboarding")({ component: OnboardingPage });

function OnboardingPage() {
  const session = authClient.useSession();
  const [platform, setPlatform] = useState<OnboardingPlatformState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/platform", { signal: controller.signal })
      .then((response) => response.json() as Promise<OnboardingPlatformState>)
      .then(setPlatform);
    return () => controller.abort();
  }, []);

  if (session.isPending || !platform) {
    return (
      <div className="grid min-h-svh place-items-center bg-[#123b2f]">
        <LoaderCircle className="size-5 animate-spin text-[#f6f0e3]" />
      </div>
    );
  }
  if (!session.data?.user) return <Navigate replace to="/" />;
  if (platform.deployment.mode !== "hosted" || platform.activeOrganizationId) {
    return <Navigate replace to="/dashboard" />;
  }
  if (!session.data.user.emailVerified) return <Navigate replace to="/" />;

  return <HostedOnboarding ownerName={session.data.user.name} />;
}
