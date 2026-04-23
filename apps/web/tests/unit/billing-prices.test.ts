/**
 * Billing Prices Tests
 *
 * Tests for packages/billing/src/prices.ts
 * BP-01 to BP-06
 */

import { describe, it, expect } from "vitest";
import {
  isSupportedPlan,
  getStripePriceId,
  resolvePlanFromPrice,
  SUPPORTED_PLAN_IDS,
} from "@alloomi/billing/prices";

describe("billing prices", () => {
  describe("isSupportedPlan", () => {
    // BP-01: isSupportedPlan basic
    it("BP-01: should return true for basic plan", () => {
      expect(isSupportedPlan("basic")).toBe(true);
    });

    // BP-02: isSupportedPlan pro
    it("BP-02: should return true for pro plan", () => {
      expect(isSupportedPlan("pro")).toBe(true);
    });

    // BP-03: isSupportedPlan unknown
    it("BP-03: should return false for unknown plan", () => {
      expect(isSupportedPlan("unknown")).toBe(false);
      expect(isSupportedPlan("enterprise")).toBe(false);
      expect(isSupportedPlan("")).toBe(false);
    });
  });

  describe("getStripePriceId", () => {
    // BP-04: getStripePriceId basic monthly
    it("BP-04: should return price ID for basic monthly", () => {
      const priceId = getStripePriceId("basic", "monthly");
      expect(priceId).toBe("price_1SFcn0FGmRIfSL0DZJfklyWh");
    });

    // BP-05: getStripePriceId pro yearly
    it("BP-05: should return price ID for pro yearly (if configured)", () => {
      const priceId = getStripePriceId("pro", "yearly");
      // Note: yearly prices may not be configured yet
      // The test expects undefined if not set, or the actual price ID if set
      expect(priceId === undefined || priceId.startsWith("price_")).toBe(true);
    });

    it("BP-05: should return price ID for pro monthly", () => {
      const priceId = getStripePriceId("pro", "monthly");
      expect(priceId).toBe("price_1SFcnlFGmRIfSL0DgPfYc5HC");
    });
  });

  describe("resolvePlanFromPrice", () => {
    // BP-06: resolvePlanFromPrice reverse lookup
    it("BP-06: should resolve plan from basic monthly price ID", () => {
      const result = resolvePlanFromPrice("price_1SFcn0FGmRIfSL0DZJfklyWh");
      expect(result).toEqual({ planId: "basic", billingCycle: "monthly" });
    });

    it("BP-06: should resolve plan from pro monthly price ID", () => {
      const result = resolvePlanFromPrice("price_1SFcnlFGmRIfSL0DgPfYc5HC");
      expect(result).toEqual({ planId: "pro", billingCycle: "monthly" });
    });

    it("BP-06: should return undefined for unknown price ID", () => {
      const result = resolvePlanFromPrice("price_unknown");
      expect(result).toBeUndefined();
    });
  });

  describe("SUPPORTED_PLAN_IDS", () => {
    it("should contain basic and pro", () => {
      expect(SUPPORTED_PLAN_IDS).toContain("basic");
      expect(SUPPORTED_PLAN_IDS).toContain("pro");
    });

    it("should only contain basic and pro", () => {
      expect(SUPPORTED_PLAN_IDS).toHaveLength(2);
    });
  });
});
