export function sponsorshipDisplayName(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

export function allocationsFitFund(
  fundAmount: number,
  allocations: Array<{ amount: number }>,
): boolean {
  const toMinorUnits = (amount: number) => Math.round(amount * 100);
  return (
    allocations.reduce((total, item) => total + toMinorUnits(item.amount), 0) <=
    toMinorUnits(fundAmount)
  );
}
