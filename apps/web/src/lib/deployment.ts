export const DEPLOYMENT_MODES = ["hosted", "self-hosted"] as const;

export type DeploymentMode = (typeof DEPLOYMENT_MODES)[number];

export type DeploymentEnvironment = {
  APP_NAME?: string;
  DEFAULT_LOCALE?: string;
  DEFAULT_ORGANIZATION_NAME?: string;
  DEFAULT_ORGANIZATION_SLUG?: string;
  DEFAULT_ORGANIZATION_TITLE?: string;
  DEFAULT_TIMEZONE?: string;
  DEPLOYMENT_MODE?: string;
  PUBLIC_APP_URL?: string;
};

export type DeploymentConfig = {
  appName: string;
  mode: DeploymentMode;
  publicAppUrl: string | null;
  defaultOrganization: {
    locale: string;
    name: string;
    slug: string;
    timezone: string;
    title: string | null;
  } | null;
  capabilities: {
    allowsInitialOwnerBootstrap: boolean;
    allowsPublicSignup: boolean;
    requiresBilling: boolean;
    requiresEmailVerification: boolean;
    supportsMultipleOrganizations: boolean;
  };
};

export function getDeploymentConfig(runtime: DeploymentEnvironment): DeploymentConfig {
  const mode = parseDeploymentMode(runtime.DEPLOYMENT_MODE);
  const publicAppUrl = parsePublicAppUrl(runtime.PUBLIC_APP_URL, mode);
  const defaultOrganization = parseDefaultOrganization(runtime, mode);

  return {
    appName: normalize(runtime.APP_NAME) || "Tsewa",
    mode,
    publicAppUrl,
    defaultOrganization,
    capabilities: {
      allowsInitialOwnerBootstrap: mode === "self-hosted",
      allowsPublicSignup: false,
      requiresBilling: mode === "hosted",
      requiresEmailVerification: mode === "hosted",
      supportsMultipleOrganizations: mode === "hosted",
    },
  };
}

export function publicAppOrigin(config: DeploymentConfig, request: Request): string {
  if (config.publicAppUrl) return config.publicAppUrl;
  if (config.mode === "hosted") throw new Error("PUBLIC_APP_URL is required in hosted mode.");
  return new URL(request.url).origin;
}

function parseDeploymentMode(value: string | undefined): DeploymentMode {
  if (value === "hosted" || value === "self-hosted") return value;
  throw new Error('DEPLOYMENT_MODE must be either "hosted" or "self-hosted".');
}

function parsePublicAppUrl(value: string | undefined, mode: DeploymentMode): string | null {
  if (!value) {
    if (mode === "hosted") throw new Error("PUBLIC_APP_URL is required in hosted mode.");
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("PUBLIC_APP_URL must be an absolute URL.");
  }

  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("PUBLIC_APP_URL must use HTTPS except on localhost.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("PUBLIC_APP_URL must be an origin without a path, query, or hash.");
  }
  return url.origin;
}

function parseDefaultOrganization(
  runtime: DeploymentEnvironment,
  mode: DeploymentMode,
): DeploymentConfig["defaultOrganization"] {
  const supplied = [
    runtime.DEFAULT_ORGANIZATION_NAME,
    runtime.DEFAULT_ORGANIZATION_SLUG,
    runtime.DEFAULT_ORGANIZATION_TITLE,
    runtime.DEFAULT_TIMEZONE,
    runtime.DEFAULT_LOCALE,
  ].some((value) => Boolean(normalize(value)));

  if (mode === "hosted") {
    if (supplied)
      throw new Error("Default organization settings are only valid in self-hosted mode.");
    return null;
  }

  const name = normalize(runtime.DEFAULT_ORGANIZATION_NAME);
  const slug = normalize(runtime.DEFAULT_ORGANIZATION_SLUG);
  if (!name) throw new Error("DEFAULT_ORGANIZATION_NAME is required in self-hosted mode.");
  if (!slug || !isValidSlug(slug)) {
    throw new Error(
      "DEFAULT_ORGANIZATION_SLUG must contain 3-48 lowercase letters, numbers, or hyphens.",
    );
  }
  if (name.length > 100)
    throw new Error("DEFAULT_ORGANIZATION_NAME must be 100 characters or fewer.");

  const title = normalize(runtime.DEFAULT_ORGANIZATION_TITLE) || null;
  if (title && title.length > 120) {
    throw new Error("DEFAULT_ORGANIZATION_TITLE must be 120 characters or fewer.");
  }

  const locale = normalize(runtime.DEFAULT_LOCALE) || "en";
  try {
    Intl.getCanonicalLocales(locale);
  } catch {
    throw new Error("DEFAULT_LOCALE must be a valid locale identifier.");
  }

  const timezone = normalize(runtime.DEFAULT_TIMEZONE) || "UTC";
  try {
    new Intl.DateTimeFormat(locale, { timeZone: timezone }).format();
  } catch {
    throw new Error("DEFAULT_TIMEZONE must be a valid IANA timezone.");
  }

  return { locale, name, slug, timezone, title };
}

function normalize(value: string | undefined): string {
  return value?.trim() ?? "";
}

function isValidSlug(value: string): boolean {
  return value.length >= 3 && /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/.test(value);
}
