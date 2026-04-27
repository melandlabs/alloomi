/**
 * Credential Store Tests
 *
 * Tests for apps/web/lib/integrations/providers/credential-store.ts
 * CS-01 to CS-06
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the dependencies before importing
vi.mock("@/lib/db/queries", () => ({
  getIntegrationAccountsByUserId: vi.fn(),
  getIntegrationAccountByPlatform: vi.fn(),
  getIntegrationAccountById: vi.fn(),
  updateIntegrationAccount: vi.fn(),
  upsertIntegrationAccount: vi.fn(),
}));

vi.mock("@/lib/credentials/rotation-service", () => ({
  rotateCredentials: vi.fn(),
  getCredentialRotationHistory: vi.fn(),
  revertToPreviousCredential: vi.fn(),
}));

describe("credential store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("WebCredentialStore", () => {
    // CS-01: Should have getAccountsByUserId method
    it("CS-01: WebCredentialStore should have getAccountsByUserId method", async () => {
      const { WebCredentialStore } =
        await import("@/lib/integrations/providers/credential-store");
      const store = new WebCredentialStore();

      expect(typeof store.getAccountsByUserId).toBe("function");
    });

    // CS-02: Should have getAccountByPlatform method
    it("CS-02: WebCredentialStore should have getAccountByPlatform method", async () => {
      const { WebCredentialStore } =
        await import("@/lib/integrations/providers/credential-store");
      const store = new WebCredentialStore();

      expect(typeof store.getAccountByPlatform).toBe("function");
    });

    // CS-03: Should have getAccountById method
    it("CS-03: WebCredentialStore should have getAccountById method", async () => {
      const { WebCredentialStore } =
        await import("@/lib/integrations/providers/credential-store");
      const store = new WebCredentialStore();

      expect(typeof store.getAccountById).toBe("function");
    });

    // CS-04: Should have updateAccount method
    it("CS-04: WebCredentialStore should have updateAccount method", async () => {
      const { WebCredentialStore } =
        await import("@/lib/integrations/providers/credential-store");
      const store = new WebCredentialStore();

      expect(typeof store.updateAccount).toBe("function");
    });

    // CS-05: Should have createAccount method
    it("CS-05: WebCredentialStore should have createAccount method", async () => {
      const { WebCredentialStore } =
        await import("@/lib/integrations/providers/credential-store");
      const store = new WebCredentialStore();

      expect(typeof store.createAccount).toBe("function");
    });
  });

  describe("Rotation methods", () => {
    // CS-06: Should have rotateCredentials method
    it("CS-06: WebCredentialStore should have rotateCredentials method", async () => {
      const { WebCredentialStore } =
        await import("@/lib/integrations/providers/credential-store");
      const store = new WebCredentialStore();

      expect(typeof store.rotateCredentials).toBe("function");
    });

    // CS-07: Should have getRotationHistory method
    it("CS-07: WebCredentialStore should have getRotationHistory method", async () => {
      const { WebCredentialStore } =
        await import("@/lib/integrations/providers/credential-store");
      const store = new WebCredentialStore();

      expect(typeof store.getRotationHistory).toBe("function");
    });

    // CS-08: Should have revertToPreviousCredential method
    it("CS-08: WebCredentialStore should have revertToPreviousCredential method", async () => {
      const { WebCredentialStore } =
        await import("@/lib/integrations/providers/credential-store");
      const store = new WebCredentialStore();

      expect(typeof store.revertToPreviousCredential).toBe("function");
    });
  });

  describe("singleton instance", () => {
    // CS-09: Should export credentialStore singleton
    it("CS-09: Should export credentialStore singleton instance", async () => {
      const { credentialStore } =
        await import("@/lib/integrations/providers/credential-store");

      expect(credentialStore).toBeTruthy();
      expect(typeof credentialStore).toBe("object");
    });

    // CS-10: credentialStore should be instance of WebCredentialStore
    it("CS-10: credentialStore should be instance of WebCredentialStore", async () => {
      const { credentialStore, WebCredentialStore } =
        await import("@/lib/integrations/providers/credential-store");

      expect(credentialStore).toBeInstanceOf(WebCredentialStore);
    });
  });
});
