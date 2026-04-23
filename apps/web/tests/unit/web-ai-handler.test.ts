/**
 * WebAIHandler Unit Tests
 *
 * Tests for the WebAIHandler implementation.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

describe("WebAIHandler", () => {
  let mockHandleAgentRuntime: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockHandleAgentRuntime = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("calls shared handleAgentRuntime with correct parameters", async () => {
    // Mock the shared module
    vi.doMock("@/lib/ai/runtime/shared", () => ({
      handleAgentRuntime: mockHandleAgentRuntime,
    }));

    // Import after mocking
    const { WebAIHandler } =
      await import("@/lib/integrations/providers/ai-handler");
    const handler = new WebAIHandler();

    const prompt = "Hello AI";
    const options = {
      userId: "user123",
      conversation: [
        { role: "user" as const, content: "Hi" },
        { role: "assistant" as const, content: "Hello!" },
      ],
      images: [{ data: "base64data", mimeType: "image/png" }],
      fileAttachments: [
        { name: "file.txt", data: "content", mimeType: "text/plain" },
      ],
      workDir: "/tmp",
      aiSoulPrompt: "You are a helpful assistant",
      language: "en",
      modelConfig: {
        apiKey: "test-key",
        baseUrl: "https://api.example.com",
        model: "claude-3",
      },
    };
    const replyCallback = vi.fn().mockResolvedValue(undefined);
    const platform = "telegram" as const;

    await handler.handleAgentRuntime(prompt, options, replyCallback, platform);

    expect(mockHandleAgentRuntime).toHaveBeenCalledTimes(1);
    expect(mockHandleAgentRuntime).toHaveBeenCalledWith(
      prompt,
      expect.objectContaining({
        userId: "user123",
        conversation: options.conversation,
        images: options.images,
        fileAttachments: options.fileAttachments,
        workDir: "/tmp",
        aiSoulPrompt: "You are a helpful assistant",
        language: "en",
        modelConfig: options.modelConfig,
      }),
      replyCallback,
      platform,
    );
  });

  test("handles minimal options", async () => {
    vi.doMock("@/lib/ai/runtime/shared", () => ({
      handleAgentRuntime: mockHandleAgentRuntime,
    }));

    const { WebAIHandler } =
      await import("@/lib/integrations/providers/ai-handler");
    const handler = new WebAIHandler();

    const options = {};
    const replyCallback = vi.fn().mockResolvedValue(undefined);
    const platform = "whatsapp" as const;

    await handler.handleAgentRuntime("Hello", options, replyCallback, platform);

    expect(mockHandleAgentRuntime).toHaveBeenCalledWith(
      "Hello",
      expect.objectContaining({}),
      replyCallback,
      platform,
    );
  });

  test("supports different platforms", async () => {
    vi.doMock("@/lib/ai/runtime/shared", () => ({
      handleAgentRuntime: mockHandleAgentRuntime,
    }));

    const { WebAIHandler } =
      await import("@/lib/integrations/providers/ai-handler");
    const handler = new WebAIHandler();

    const platforms = [
      "telegram",
      "whatsapp",
      "imessage",
      "gmail",
      "feishu",
      "dingtalk",
      "qqbot",
      "weixin",
    ] as const;

    for (const platform of platforms) {
      mockHandleAgentRuntime.mockClear();
      const replyCallback = vi.fn().mockResolvedValue(undefined);

      await handler.handleAgentRuntime("test", {}, replyCallback, platform);

      expect(mockHandleAgentRuntime).toHaveBeenCalledWith(
        "test",
        expect.any(Object),
        replyCallback,
        platform,
      );
    }
  });
});

describe("webAIHandler Singleton", () => {
  test("webAIHandler instance is available", async () => {
    // No mocking needed for this test
    const { webAIHandler } =
      await import("@/lib/integrations/providers/ai-handler");
    expect(webAIHandler).toBeDefined();
    expect(typeof webAIHandler.handleAgentRuntime).toBe("function");
  });
});
