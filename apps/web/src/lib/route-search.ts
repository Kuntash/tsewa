import { z } from "zod";

export function optionalString(value: unknown, maximumLength = 120) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maximumLength) : undefined;
}

export function optionalPage(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const page = typeof value === "number" ? value : Number(value.trim());
  return Number.isSafeInteger(page) && page > 1 ? page : undefined;
}

export function optionalEnum<const T extends string>(value: unknown, values: readonly T[]) {
  return typeof value === "string" && values.includes(value as T) ? (value as T) : undefined;
}

const stringParam = (maximumLength = 120) =>
  z
    .unknown()
    .optional()
    .transform((value) => optionalString(value, maximumLength));
const pageParam = z.unknown().optional().transform(optionalPage);
const enumParam = <const T extends string>(values: readonly T[]) =>
  z
    .unknown()
    .optional()
    .transform((value) => optionalEnum(value, values));

export const peopleSearchSchema = z.object({
  q: stringParam(100),
  kind: enumParam(["child", "elderly", "staff"] as const),
  status: enumParam(["active", "inactive"] as const),
  page: pageParam,
});

export const schoolSearchSchema = z.object({
  q: stringParam(100),
  school: stringParam(),
  class: stringParam(),
  house: stringParam(),
  status: enumParam(["recorded", "enrolled", "transferred", "withdrawn", "completed"] as const),
  section: enumParam(["students", "schools", "rosters", "setup", "results"] as const),
  page: pageParam,
  rosterQ: stringParam(100),
  rosterSchool: stringParam(),
  resultQ: stringParam(100),
  resultSession: stringParam(),
  resultSchool: stringParam(),
  resultClass: stringParam(),
  resultSubject: stringParam(),
  resultTerm: stringParam(),
  resultPage: pageParam,
});

export const staffSearchSchema = z.object({
  q: stringParam(100),
  status: enumParam(["active", "inactive"] as const),
  department: stringParam(),
  page: pageParam,
});

export const healthSearchSchema = z.object({
  section: enumParam(["diagnosis", "tb", "advances"] as const),
  q: stringParam(100),
  kind: enumParam(["child", "elderly", "staff", "other"] as const),
  outcome: stringParam(),
  settlement: stringParam(),
  page: pageParam,
});

export const scholarshipSearchSchema = z.object({
  q: stringParam(100),
  status: enumParam(["active", "closed"] as const),
  course: stringParam(),
  page: pageParam,
});

export const sponsorshipSearchSchema = z.object({
  section: enumParam(["sponsors", "assignments", "funds", "correspondence", "visitors"] as const),
  q: stringParam(100),
  page: pageParam,
});

export const reportsSearchSchema = z.object({
  domain: enumParam(["scholarship", "sponsorship"] as const),
  report: stringParam(),
  session: stringParam(),
  q: stringParam(100),
});

export const settingsSearchSchema = z.object({
  auditQ: stringParam(100),
  auditAction: stringParam(120),
  auditPage: pageParam,
});

export const homeSearchSchema = settingsSearchSchema.extend({
  view: enumParam([
    "dashboard",
    "people",
    "school",
    "health",
    "scholarship",
    "sponsorship",
    "staff",
    "reports",
    "settings",
  ] as const),
  settingsTab: enumParam(["general", "sessions", "members", "roles", "security", "audit"] as const),
  invite: stringParam(256),
});
