import { describe, it, expect } from "vitest";
import {
  entitlementsByUserType,
  getInsightHistoryDays,
  isFreeUser,
  isPaidUser,
  getPlanConfig,
  getPlanPricing,
  getPlanMonthlyCredits,
  getPlanCreditsLabel,
  getPlanFeatureList,
} from "@alloomi/billing/entitlements";

describe("entitlements", () => {
  it("identifies free and paid users", () => {
    expect(isFreeUser("guest")).toBe(true);
    expect(isFreeUser("basic")).toBe(false);
    expect(isPaidUser("pro")).toBe(true);
    expect(isPaidUser("unknown")).toBe(false);
  });

  it("returns insight history days for known type", () => {
    expect(getInsightHistoryDays("pro")).toBe(
      entitlementsByUserType.pro.insightHistoryDays,
    );
  });

  it("defaults to regular entitlements for unknown type", () => {
    expect(getInsightHistoryDays("random" as any)).toBe(
      entitlementsByUserType.regular.insightHistoryDays,
    );
  });

  describe("getPlanConfig", () => {
    // BE-01: returns basic plan config
    it("BE-01: should return basic plan config", () => {
      const result = getPlanConfig("basic");
      expect(result?.id).toBe("basic");
      expect(result?.nameKey).toBe("plans.basic");
      expect(result?.pricing.monthly?.amount).toBe(15);
      expect(result?.pricing.yearly?.amount).toBe(153);
    });

    // BE-02: returns pro plan config
    it("BE-02: should return pro plan config", () => {
      const result = getPlanConfig("pro");
      expect(result?.id).toBe("pro");
      expect(result?.nameKey).toBe("plans.pro");
      expect(result?.pricing.monthly?.amount).toBe(39);
      expect(result?.pricing.yearly?.amount).toBe(398);
    });
  });

  describe("getPlanPricing", () => {
    // BE-03: basic monthly pricing
    it("BE-03: should return basic monthly pricing", () => {
      const result = getPlanPricing("basic", "monthly");
      expect(result?.amount).toBe(15);
      expect(result?.currency).toBe("USD");
    });

    // BE-04: pro yearly pricing
    it("BE-04: should return pro yearly pricing", () => {
      const result = getPlanPricing("pro", "yearly");
      expect(result?.amount).toBe(398);
      expect(result?.currency).toBe("USD");
    });

    // BE-05: unknown plan returns undefined
    it("BE-05: should return undefined for unknown plan", () => {
      const result = getPlanPricing("unknown" as any, "monthly");
      expect(result).toBeUndefined();
    });
  });

  describe("getPlanMonthlyCredits", () => {
    // BE-06: basic plan credits
    it("BE-06: should return basic plan monthly credits", () => {
      const result = getPlanMonthlyCredits("basic");
      expect(result).toBe(500000);
    });

    // BE-07: pro plan credits
    it("BE-07: should return pro plan monthly credits", () => {
      const result = getPlanMonthlyCredits("pro");
      expect(result).toBe(1500000);
    });

    // BE-08: unknown plan returns 0
    it("BE-08: should return 0 for unknown plan", () => {
      const result = getPlanMonthlyCredits("unknown" as any);
      expect(result).toBe(0);
    });
  });

  describe("getPlanCreditsLabel", () => {
    // BE-09: basic monthly label
    it("BE-09: should return basic monthly credits label", () => {
      const result = getPlanCreditsLabel("basic", "monthly");
      expect(result).toBe("500,000 credits per month");
    });

    // BE-10: basic yearly label
    it("BE-10: should return basic yearly credits label", () => {
      const result = getPlanCreditsLabel("basic", "yearly");
      expect(result).toBe("6,000,000 credits per year");
    });

    // BE-11: pro monthly label
    it("BE-11: should return pro monthly credits label", () => {
      const result = getPlanCreditsLabel("pro", "monthly");
      expect(result).toBe("1,500,000 credits per month");
    });

    // BE-12: unknown plan returns empty string
    it("BE-12: should return empty string for unknown plan", () => {
      const result = getPlanCreditsLabel("unknown" as any, "monthly");
      expect(result).toBe("");
    });
  });

  describe("getPlanFeatureList", () => {
    // BE-13: basic plan features
    it("BE-13: should return basic plan feature list", () => {
      const result = getPlanFeatureList("basic");
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("History retention: 30 days");
    });

    // BE-14: pro plan features
    it("BE-14: should return pro plan feature list", () => {
      const result = getPlanFeatureList("pro");
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("History retention: 90 days");
    });

    // BE-15: unknown plan returns empty array
    it("BE-15: should return empty array for unknown plan", () => {
      const result = getPlanFeatureList("unknown" as any);
      expect(result).toEqual([]);
    });
  });
});
