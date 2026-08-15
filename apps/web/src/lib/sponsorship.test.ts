import { describe, expect, it } from "vitest";

import { allocationsFitFund, sponsorshipDisplayName } from "./sponsorship";

describe("sponsorshipDisplayName", () => {
  it("joins recorded name parts without introducing extra whitespace", () => {
    expect(sponsorshipDisplayName([" Tenzin ", null, "Dolma"])).toBe("Tenzin Dolma");
  });
});

describe("allocationsFitFund", () => {
  it("allows partial and exact beneficiary allocations", () => {
    expect(allocationsFitFund(100, [{ amount: 40 }, { amount: 59.99 }])).toBe(true);
    expect(allocationsFitFund(100, [{ amount: 40 }, { amount: 60 }])).toBe(true);
  });

  it("rejects allocations above the received remittance", () => {
    expect(allocationsFitFund(100, [{ amount: 40 }, { amount: 60.01 }])).toBe(false);
  });

  it("compares currency in minor units to avoid floating-point drift", () => {
    expect(allocationsFitFund(0.3, [{ amount: 0.1 }, { amount: 0.2 }])).toBe(true);
  });
});
