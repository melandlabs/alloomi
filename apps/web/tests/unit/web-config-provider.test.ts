/**
 * WebConfigProvider Unit Tests
 *
 * Tests for the WebConfigProvider implementation.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the dependencies before importing
vi.mock("@/lib/env/constants", () => ({
  DEFAULT_AI_MODEL: "anthropic/claude-sonnet-4.6",
  AI_PROXY_BASE_URL: "http://localhost:3000/api/ai",
}));

vi.mock("@/lib/utils/path", () => ({
  getAppMemoryDir: vi.fn(() => "/mock/memory/dir"),
}));

describe("WebConfigProvider", () => {
  let WebConfigProvider: typeof import("@/lib/integrations/providers/config-provider").WebConfigProvider;
  let provider: InstanceType<
    typeof import("@/lib/integrations/providers/config-provider").WebConfigProvider
  >;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import("@/lib/integrations/providers/config-provider");
    WebConfigProvider = module.WebConfigProvider;
    provider = new WebConfigProvider();
    // Reset env
    process.env = { ...process.env };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("get()", () => {
    test("returns undefined when key is not set", () => {
      process.env.TEST_KEY = undefined;
      expect(provider.get("TEST_KEY")).toBeUndefined();
    });

    test("returns value when key is set", () => {
      process.env.TEST_KEY = "test-value";
      expect(provider.get("TEST_KEY")).toBe("test-value");
    });

    test("returns empty string when key is empty", () => {
      process.env.TEST_KEY = "";
      expect(provider.get("TEST_KEY")).toBe("");
    });
  });

  describe("getRequired()", () => {
    test("returns value when key is set", () => {
      process.env.REQUIRED_KEY = "required-value";
      expect(provider.getRequired("REQUIRED_KEY")).toBe("required-value");
    });

    test("throws error when key is not set", () => {
      process.env.REQUIRED_KEY = undefined;
      expect(() => provider.getRequired("REQUIRED_KEY")).toThrow(
        'Config key "REQUIRED_KEY" is not configured',
      );
    });

    test("throws error when key is empty string", () => {
      process.env.REQUIRED_KEY = "";
      expect(() => provider.getRequired("REQUIRED_KEY")).toThrow(
        'Config key "REQUIRED_KEY" is not configured',
      );
    });
  });

  describe("getDefaultAIModel()", () => {
    test("returns default AI model from constants", () => {
      expect(provider.getDefaultAIModel()).toBe("anthropic/claude-sonnet-4.6");
    });
  });

  describe("getAIProxyBaseUrl()", () => {
    test("returns AI proxy base URL from constants", () => {
      expect(provider.getAIProxyBaseUrl()).toBe("http://localhost:3000/api/ai");
    });
  });

  describe("getAppMemoryDir()", () => {
    test("returns app memory directory from path utility", () => {
      expect(provider.getAppMemoryDir()).toBe("/mock/memory/dir");
    });
  });
});
