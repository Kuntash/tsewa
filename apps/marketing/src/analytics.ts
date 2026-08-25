import type { PostHogInterface } from "posthog-js/dist/module.no-external";

type AnalyticsEvent =
  | "demo_dimension_selected"
  | "demo_person_selected"
  | "enterprise_contact_clicked"
  | "faq_toggled"
  | "marketing_page_viewed"
  | "migration_contact_clicked"
  | "signup_cta_clicked"
  | "walkthrough_contact_clicked";

type AnalyticsProperties = Record<string, boolean | number | string>;

const pendingEvents: Array<{ event: AnalyticsEvent; properties: AnalyticsProperties }> = [];
let analyticsClient: PostHogInterface | null = null;
let analyticsConfigured = false;

function pageName(pathname: string) {
  const path = pathname.replace(/^\/+|\/+$/g, "");
  return path || "home";
}

function withoutQueryOrFragment(value: unknown) {
  if (typeof value !== "string") return value;

  try {
    const url = new URL(value, window.location.origin);
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

export async function initializeAnalytics() {
  const projectKey = import.meta.env.VITE_POSTHOG_KEY?.trim();
  const isLocal = ["127.0.0.1", "localhost"].includes(window.location.hostname);

  if (!projectKey || isLocal) return;
  analyticsConfigured = true;

  const posthog = await import("posthog-js/dist/module.no-external")
    .then((module) => module.default)
    .catch(() => null);
  if (!posthog) {
    analyticsConfigured = false;
    pendingEvents.length = 0;
    return;
  }

  posthog.init(projectKey, {
    api_host: import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com",
    ui_host: import.meta.env.VITE_POSTHOG_UI_HOST?.trim() || "https://eu.posthog.com",
    defaults: "2026-05-30",
    autocapture: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    capture_heatmaps: false,
    capture_pageleave: false,
    capture_pageview: false,
    capture_performance: false,
    cookieless_mode: "always",
    disable_session_recording: true,
    disable_surveys: true,
    person_profiles: "never",
    persistence: "memory",
    respect_dnt: true,
    before_send(event) {
      if (!event) return null;

      const properties = { ...event.properties };
      for (const key of [
        "$current_url",
        "$initial_current_url",
        "$referrer",
        "$initial_referrer",
      ]) {
        const sanitized = withoutQueryOrFragment(properties[key]);
        if (sanitized === undefined) delete properties[key];
        else properties[key] = sanitized;
      }

      return { ...event, properties };
    },
    loaded(instance) {
      analyticsClient = instance;
      captureAnalytics("marketing_page_viewed", { page: pageName(window.location.pathname) });
      for (const pending of pendingEvents.splice(0)) {
        instance.capture(pending.event, pending.properties);
      }
    },
  });
}

export function captureAnalytics(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  if (!analyticsConfigured) return;
  if (!analyticsClient) {
    if (pendingEvents.length < 20) pendingEvents.push({ event, properties });
    return;
  }
  analyticsClient.capture(event, properties);
}
