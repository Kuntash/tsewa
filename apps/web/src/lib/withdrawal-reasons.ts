// A reason recorded before the list existed stays selectable on its own record.
export function withdrawalReasonOptions(reasons: string[], current?: string | null): string[] {
  const value = current?.trim();
  if (!value || reasons.includes(value)) return reasons;
  return [value, ...reasons];
}
