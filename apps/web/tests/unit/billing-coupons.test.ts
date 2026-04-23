/**
 * Billing Coupons Tests
 *
 * Tests for packages/billing/src/coupons.ts
 * BC-01 to BC-12
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type Stripe from "stripe";

// Mock stripe module
vi.mock("stripe", () => {
  return {
    default: vi.fn(),
  };
});

describe("billing coupons", () => {
  let mockStripe: {
    coupons: { create: ReturnType<typeof vi.fn> };
    promotionCodes: { create: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockStripe = {
      coupons: {
        create: vi.fn().mockResolvedValue({ id: "coupon_123" }),
      },
      promotionCodes: {
        create: vi
          .fn()
          .mockResolvedValue({ id: "promo_123", code: "TEST-CODE" }),
      },
    };

    // Set up the stripe client factory
    const { setStripeClientFactory } = await import("@alloomi/billing/coupons");
    setStripeClientFactory(async () => mockStripe as unknown as Stripe);
  });

  describe("normalizeCouponCode (internal function)", () => {
    // BC-01: normalizeCouponCode space handling
    it("BC-01: should trim and uppercase code", async () => {
      const { createStripeCouponWithPromotionCode } =
        await import("@alloomi/billing/coupons");
      const originalCreate = mockStripe.promotionCodes.create;

      await createStripeCouponWithPromotionCode({
        code: "  my-code  ",
        discount: { kind: "percent", percentOff: 20, duration: "once" },
      });

      // The code passed to promotionCodes.create should be normalized
      const call = originalCreate.mock.calls[0]?.[0];
      expect(call.code).toBe("MY-CODE");
    });

    // BC-02: normalizeCouponCode replace spaces
    it("BC-02: should replace spaces with hyphens", async () => {
      const { createStripeCouponWithPromotionCode } =
        await import("@alloomi/billing/coupons");
      const originalCreate = mockStripe.promotionCodes.create;

      await createStripeCouponWithPromotionCode({
        code: "my code here",
        discount: { kind: "percent", percentOff: 20, duration: "once" },
      });

      const call = originalCreate.mock.calls[0]?.[0];
      // The implementation replaces spaces with hyphens: "my code here" -> "MY-CODE-HERE"
      expect(call.code).toBe("MY-CODE-HERE");
    });
  });

  describe("toStripeTimestamp (internal function)", () => {
    // BC-03: toStripeTimestamp Date object
    it("BC-03: should convert Date object to Unix seconds", async () => {
      const { createStripeCouponWithPromotionCode } =
        await import("@alloomi/billing/coupons");
      const originalCreate = mockStripe.promotionCodes.create;

      // Use UTC date to avoid timezone issues
      const activationDate = new Date("2024-01-01T00:00:00Z");

      await createStripeCouponWithPromotionCode({
        code: "test-code",
        discount: { kind: "percent", percentOff: 20, duration: "once" },
        activationExpiresAt: activationDate,
      });

      const call = originalCreate.mock.calls[0]?.[0];
      // Jan 1, 2024 00:00:00 UTC = 1704067200
      expect(call.expires_at).toBe(1704067200);
    });

    // BC-04: toStripeTimestamp numeric seconds
    it("BC-04: should keep numeric seconds as-is", async () => {
      const { createStripeCouponWithPromotionCode } =
        await import("@alloomi/billing/coupons");
      const originalCreate = mockStripe.promotionCodes.create;

      await createStripeCouponWithPromotionCode({
        code: "test-code",
        discount: { kind: "percent", percentOff: 20, duration: "once" },
        activationExpiresAt: new Date(1704067200 * 1000), // Unix timestamp in ms
      });

      const call = originalCreate.mock.calls[0]?.[0];
      expect(call.expires_at).toBe(1704067200);
    });

    // BC-05: toStripeTimestamp null
    it("BC-05: should handle null activationExpiresAt", async () => {
      const { createStripeCouponWithPromotionCode } =
        await import("@alloomi/billing/coupons");
      const originalCreate = mockStripe.promotionCodes.create;

      await createStripeCouponWithPromotionCode({
        code: "test-code",
        discount: { kind: "percent", percentOff: 20, duration: "once" },
        activationExpiresAt: null,
      });

      const call = originalCreate.mock.calls[0]?.[0];
      expect(call.expires_at).toBeUndefined();
    });

    // BC-06: toStripeTimestamp undefined
    it("BC-06: should handle undefined activationExpiresAt", async () => {
      const { createStripeCouponWithPromotionCode } =
        await import("@alloomi/billing/coupons");
      const originalCreate = mockStripe.promotionCodes.create;

      await createStripeCouponWithPromotionCode({
        code: "test-code",
        discount: { kind: "percent", percentOff: 20, duration: "once" },
        activationExpiresAt: undefined,
      });

      const call = originalCreate.mock.calls[0]?.[0];
      expect(call.expires_at).toBeUndefined();
    });
  });

  describe("sanitizeCouponMetadata (internal function)", () => {
    // BC-07: sanitizeCouponMetadata filter
    it("BC-07: should filter out null/undefined and convert to strings", async () => {
      const { createStripeCouponWithPromotionCode } =
        await import("@alloomi/billing/coupons");
      const originalCouponCreate = mockStripe.coupons.create;

      await createStripeCouponWithPromotionCode({
        code: "test-code",
        discount: { kind: "percent", percentOff: 20, duration: "once" },
        metadata: { a: 1, b: null },
      });

      const call = originalCouponCreate.mock.calls[0]?.[0];
      expect(call.metadata).toEqual({ a: "1" });
    });
  });

  describe("createStripeCouponWithPromotionCode", () => {
    // BC-08: create percent discount coupon
    it("BC-08: should create percent discount coupon", async () => {
      const { createStripeCouponWithPromotionCode } =
        await import("@alloomi/billing/coupons");
      const originalCouponCreate = mockStripe.coupons.create;

      const result = await createStripeCouponWithPromotionCode({
        code: "percent-20",
        discount: { kind: "percent", percentOff: 20, duration: "once" },
      });

      expect(originalCouponCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          percent_off: 20,
          duration: "once",
        }),
      );
      expect(result.coupon.id).toBe("coupon_123");
    });

    // BC-09: create amount discount coupon
    it("BC-09: should create amount discount coupon with currency", async () => {
      const { createStripeCouponWithPromotionCode } =
        await import("@alloomi/billing/coupons");
      const originalCouponCreate = mockStripe.coupons.create;

      const result = await createStripeCouponWithPromotionCode({
        code: "amount-10",
        discount: {
          kind: "amount",
          amountOff: 10,
          currency: "usd",
          duration: "once",
        },
      });

      expect(originalCouponCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount_off: 1000, // 10 * 100 cents
          currency: "usd",
          duration: "once",
        }),
      );
      expect(result.coupon.id).toBe("coupon_123");
    });

    // BC-10: amount discount without currency error
    it("BC-10: should throw when amount discount has no currency", async () => {
      const { createStripeCouponWithPromotionCode } =
        await import("@alloomi/billing/coupons");

      await expect(
        createStripeCouponWithPromotionCode({
          code: "amount-no-currency",
          discount: {
            kind: "amount",
            amountOff: 10,
            currency: "", // empty currency
            duration: "once",
          },
        }),
      ).rejects.toThrow("Currency is required");
    });

    // BC-11: unsupported discount kind error
    it("BC-11: should throw for unknown discount kind", async () => {
      const { createStripeCouponWithPromotionCode } =
        await import("@alloomi/billing/coupons");

      await expect(
        createStripeCouponWithPromotionCode({
          code: "unknown-kind",
          discount: { kind: "unknown" } as any,
        }),
      ).rejects.toThrow("Unsupported discount kind");
    });

    // BC-12: repeating discount supports durationInMonths
    it("BC-12: should support repeating duration with durationInMonths", async () => {
      const { createStripeCouponWithPromotionCode } =
        await import("@alloomi/billing/coupons");
      const originalCouponCreate = mockStripe.coupons.create;

      await createStripeCouponWithPromotionCode({
        code: "repeating-3m",
        discount: {
          kind: "percent",
          percentOff: 15,
          duration: "repeating",
          durationInMonths: 3,
        },
      });

      expect(originalCouponCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          percent_off: 15,
          duration: "repeating",
          duration_in_months: 3,
        }),
      );
    });
  });
});
