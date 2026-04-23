import { describe, it, expect } from "vitest";

// We need to access the private functions or export them for testing.
// Since they are not exported, we might need to modify email.ts to export them or rely on a rewiring approach.
// For simplicity and cleaner code, I will update email.ts to export them as named exports
// (or I can copy them here for testing if I don't want to change public API, but exporting is better).

// Wait, I can't easily change the export without breaking other things potentially or user preference.
// But `email.ts` already has many exports. I will check if I can just import them if I export them.
// Let's assume I will export them.

// ACTUALLY, checking the file content again, they are just functions defined specific to the file.
// To test them properly, I should probably export them.
// I will start by modifying email.ts to export these utility functions.

import { stripQuotedText, isBoilerplate } from "@/lib/integrations/email";

describe("Email Processing Logic", () => {
  describe("stripQuotedText", () => {
    it("should preserve inline replies", () => {
      const input = `
Hi there,

On 2023-01-01, User wrote:
> Do you like apples?

Yes, I love them.

> How about bananas?

They are okay too.
      `.trim();

      const expected = `
Hi there,

Yes, I love them.

They are okay too.
      `.trim();

      expect(stripQuotedText(input)).toBe(expected);
    });

    it("should strip standard Gmail reply", () => {
      const input = `
This is my reply.

On Mon, Jan 1, 2023 at 10:00 AM User <user@example.com> wrote:
> This is the old message.
> And another line.
      `.trim();

      expect(stripQuotedText(input)).toBe("This is my reply.");
    });

    it("should truncate Legacy/Outlook reply", () => {
      const input = `
This is the top message.

From: Old User
Sent: Thursday, January 1, 2023 10:00 AM
To: Current User
Subject: Re: Hello

This is the old message content.
       `.trim();

      expect(stripQuotedText(input)).toBe("This is the top message.");
    });

    it('should handle "Original Message" separator', () => {
      const input = `
Reply text.

-----Original Message-----
From: ...
        `.trim();
      expect(stripQuotedText(input)).toBe("Reply text.");
    });
  });

  describe("isBoilerplate", () => {
    it("should detect unsubscribe links", () => {
      expect(isBoilerplate("Unsubscribe")).toBe(true);
      expect(isBoilerplate("Safe Unsubscribe")).toBe(true);
      expect(isBoilerplate("Click here to unsubscribe")).toBe(true);
    });

    it("should detect navigation footers", () => {
      expect(isBoilerplate("Home | About | Contact")).toBe(true);
      expect(isBoilerplate("Privacy Policy · Terms")).toBe(true);
    });

    it("should not flag legitimate short sentences", () => {
      expect(isBoilerplate("See you soon.")).toBe(false);
      expect(isBoilerplate("Thanks!")).toBe(false);
    });
  });
});
