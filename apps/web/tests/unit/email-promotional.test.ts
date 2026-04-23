/**
 * Tests for promotional email detection
 */

import { describe, it, expect } from "vitest";
import { isPromotionalEmail } from "@/lib/integrations/email";

/** Helper to build a minimal ParsedMail-like object */
function mockParsed(overrides: {
  fromAddress?: string;
  subject?: string;
  headers?: Array<[string, string]>;
}) {
  const headers = new Map<string, string>(overrides.headers ?? []);
  const mapHeaders = {
    has: (key: string) => headers.has(key),
    get: (key: string) => headers.get(key),
  };
  return {
    from: overrides.fromAddress
      ? { value: [{ address: overrides.fromAddress }] }
      : undefined,
    subject: overrides.subject,
    headers: mapHeaders,
  } as any;
}

describe("isPromotionalEmail", () => {
  describe("signal 5: subscription domain patterns", () => {
    it("flags Apple News emails", () => {
      const email = mockParsed({
        fromAddress: "newsletter@email.apple.com",
        subject: "Today's Top Stories",
      });
      expect(isPromotionalEmail(email)).toBe(true);
    });

    it("flags emails from apple.com domain", () => {
      const email = mockParsed({
        fromAddress: "donotreply@apple.com",
        subject: "Apple News+ Weekly Digest",
      });
      expect(isPromotionalEmail(email)).toBe(true);
    });

    it("flags emails from news.apple.com", () => {
      const email = mockParsed({
        fromAddress: "alerts@news.apple.com",
        subject: "Breaking News",
      });
      expect(isPromotionalEmail(email)).toBe(true);
    });

    it("flags emails from .news domains", () => {
      const email = mockParsed({
        fromAddress: "hello@example.news",
        subject: "Weekly Update",
      });
      expect(isPromotionalEmail(email)).toBe(true);
    });

    it("flags emails with newsletter in domain", () => {
      const email = mockParsed({
        fromAddress: "updates@newsletter.example.com",
        subject: "Your Weekly Digest",
      });
      expect(isPromotionalEmail(email)).toBe(true);
    });
  });

  describe("signal 6: promotion subject patterns", () => {
    it("flags subject with 'newsletter'", () => {
      const email = mockParsed({
        fromAddress: "team@company.com",
        subject: "Company Newsletter - March Edition",
      });
      expect(isPromotionalEmail(email)).toBe(true);
    });

    it("flags subject with 'digest'", () => {
      const email = mockParsed({
        fromAddress: "updates@company.com",
        subject: "Your Weekly Digest",
      });
      expect(isPromotionalEmail(email)).toBe(true);
    });

    it("flags subject with 'weekly'", () => {
      const email = mockParsed({
        fromAddress: "updates@company.com",
        subject: "Weekly Update for March",
      });
      expect(isPromotionalEmail(email)).toBe(true);
    });

    it("flags subject with 'monthly'", () => {
      const email = mockParsed({
        fromAddress: "news@company.com",
        subject: "Monthly Report Summary",
      });
      expect(isPromotionalEmail(email)).toBe(true);
    });

    it("flags subject with 'subscription'", () => {
      const email = mockParsed({
        fromAddress: "support@service.com",
        subject: "Your Subscription Renewal",
      });
      expect(isPromotionalEmail(email)).toBe(true);
    });

    it("flags subject with 'apple news'", () => {
      const email = mockParsed({
        fromAddress: "updates@somewhere.com",
        subject: "Apple News: Today's Highlights",
      });
      expect(isPromotionalEmail(email)).toBe(true);
    });
  });

  describe("signals 1-4: header-based detection", () => {
    it("returns true when 2+ signals present", () => {
      const email = mockParsed({
        fromAddress: "newsletter@marketing.com",
        subject: "Sale",
        headers: [
          ["list-unsubscribe", "mailto:unsub@example.com"],
          ["precedence", "bulk"],
        ],
      });
      expect(isPromotionalEmail(email)).toBe(true);
    });

    it("returns false when only 1 signal present (list-unsubscribe only)", () => {
      const email = mockParsed({
        fromAddress: "team@company.com",
        subject: "Meeting Notes",
        headers: [["list-unsubscribe", "mailto:unsub@example.com"]],
      });
      expect(isPromotionalEmail(email)).toBe(false);
    });

    it("returns false when only precedence: bulk (1 signal)", () => {
      const email = mockParsed({
        headers: [["precedence", "bulk"]],
      });
      expect(isPromotionalEmail(email)).toBe(false);
    });

    it("returns false when only marketing sender pattern (1 signal)", () => {
      const email = mockParsed({
        fromAddress: "promo@marketing.com",
        subject: "Sale",
      });
      expect(isPromotionalEmail(email)).toBe(false);
    });

    it("returns false when only marketing header (1 signal)", () => {
      const email = mockParsed({
        headers: [["x-campaign", "abc123"]],
      });
      expect(isPromotionalEmail(email)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("returns false for normal personal emails", () => {
      const email = mockParsed({
        fromAddress: "alice@gmail.com",
        subject: "Re: Project Update",
        headers: [],
      });
      expect(isPromotionalEmail(email)).toBe(false);
    });

    it("returns false for colleague work emails", () => {
      const email = mockParsed({
        fromAddress: "bob@company.com",
        subject: "Project status update",
      });
      expect(isPromotionalEmail(email)).toBe(false);
    });
  });
});
