export function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function optionalPage(value: unknown) {
  const page = typeof value === "number" ? value : Number(value);
  return Number.isInteger(page) && page > 1 ? page : undefined;
}

export function optionalEnum<const T extends string>(value: unknown, values: readonly T[]) {
  return typeof value === "string" && values.includes(value as T) ? (value as T) : undefined;
}
