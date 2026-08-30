export type InstantValue = number | string | Date;

export function toEpochMilliseconds(value: InstantValue): number {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();

  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const epoch = Date.parse(normalized);
  if (!Number.isFinite(epoch)) throw new RangeError(`Invalid instant: ${value}`);
  return epoch;
}

export function formatInstant(
  value: InstantValue,
  locale: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
    timeZone,
  }).format(toEpochMilliseconds(value));
}
