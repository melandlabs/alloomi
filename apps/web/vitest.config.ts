// vite.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

const alias = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  resolve: {
    alias: [
      // Specific paths first (higher priority)
      {
        find: "@alloomi/shared/errors",
        replacement: alias("../../packages/shared/src/errors.ts"),
      },
      {
        find: "@alloomi/security/token-encryption",
        replacement: alias("../../packages/security/src/token-encryption.ts"),
      },
      {
        find: "@alloomi/security/url-validator",
        replacement: alias("../../packages/security/src/url-validator.ts"),
      },
      // agent subpaths - must be before the shorter @alloomi/agent alias
      {
        find: "@alloomi/agent/types",
        replacement: alias("../../packages/ai/src/agent/types.ts"),
      },
      {
        find: "@alloomi/agent/registry",
        replacement: alias("../../packages/ai/src/agent/registry.ts"),
      },
      {
        find: "@alloomi/agent/sandbox",
        replacement: alias("../../packages/ai/src/agent/sandbox/index.ts"),
      },
      {
        find: "@alloomi/agent/plugin",
        replacement: alias("../../packages/ai/src/agent/plugin.ts"),
      },
      {
        find: "@alloomi/agent/base",
        replacement: alias("../../packages/ai/src/agent/base.ts"),
      },
      // agent/ai subpaths - must be before the shorter @alloomi/agent/ai alias
      {
        find: "@alloomi/agent/ai/request-context",
        replacement: alias("../../packages/ai/src/agent/ai/request-context.ts"),
      },
      {
        find: "@alloomi/agent/ai/providers",
        replacement: alias("../../packages/ai/src/agent/ai/providers.ts"),
      },
      {
        find: "@alloomi/agent/ai/router",
        replacement: alias("../../packages/ai/src/agent/ai/router.ts"),
      },
      {
        find: "@alloomi/agent/ai/tokens",
        replacement: alias("../../packages/ai/src/agent/ai/tokens.ts"),
      },
      {
        find: "@alloomi/agent/ai/*",
        replacement: alias("../../packages/ai/src/agent/ai/*"),
      },
      {
        find: "@alloomi/agent/ai",
        replacement: alias("../../packages/ai/src/agent/ai/index.ts"),
      },
      // @alloomi/ai/agent subpaths - must be before @alloomi/ai/*
      {
        find: "@alloomi/ai/agent/context",
        replacement: alias("../../packages/ai/src/agent/context"),
      },
      {
        find: "@alloomi/ai/agent/compaction",
        replacement: alias("../../packages/ai/src/agent/compaction"),
      },
      {
        find: "@alloomi/ai/agent/registry",
        replacement: alias("../../packages/ai/src/agent/registry"),
      },
      {
        find: "@alloomi/ai/agent/billing",
        replacement: alias("../../packages/ai/src/agent/billing"),
      },
      {
        find: "@alloomi/ai/agent/model",
        replacement: alias("../../packages/ai/src/agent/model"),
      },
      {
        find: "@alloomi/ai/agent/routing",
        replacement: alias("../../packages/ai/src/agent/routing"),
      },
      {
        find: "@alloomi/ai/agent/sandbox",
        replacement: alias("../../packages/ai/src/agent/sandbox"),
      },
      {
        find: "@alloomi/ai/agent/plugin",
        replacement: alias("../../packages/ai/src/agent/plugin.ts"),
      },
      {
        find: "@alloomi/ai/agent/types",
        replacement: alias("../../packages/ai/src/agent/types.ts"),
      },
      {
        find: "@alloomi/ai/agent/*",
        replacement: alias("../../packages/ai/src/agent/*"),
      },
      {
        find: "@alloomi/ai/agent",
        replacement: alias("../../packages/ai/src/agent/index.ts"),
      },
      // @alloomi/ai subpaths - store and memory
      {
        find: "@alloomi/ai/store",
        replacement: alias("../../packages/ai/src/store/index.ts"),
      },
      {
        find: "@alloomi/ai/memory",
        replacement: alias("../../packages/ai/src/memory/index.ts"),
      },
      // @alloomi/ai/* wildcard - matches single segment subpaths
      {
        find: "@alloomi/ai/*",
        replacement: alias("../../packages/ai/src/*"),
      },
      {
        find: "@alloomi/ai",
        replacement: alias("../../packages/ai/src/index.ts"),
      },
      {
        find: "@alloomi/audit",
        replacement: alias("../../packages/audit/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/channels/sources/types",
        replacement: alias(
          "../../packages/integrations/channels/src/sources/types.ts",
        ),
      },
      // Package roots
      {
        find: "@alloomi/mcp",
        replacement: alias("../../packages/ai/mcp/src/index.ts"),
      },
      // rag subpaths - must be before the shorter @alloomi/rag alias
      {
        find: "@alloomi/rag/universal-embeddings",
        replacement: alias("../../packages/ai/rag/src/universal-embeddings.ts"),
      },
      {
        find: "@alloomi/rag/*",
        replacement: alias("../../packages/ai/rag/src/*"),
      },
      {
        find: "@alloomi/rag",
        replacement: alias("../../packages/ai/rag/src/index.ts"),
      },
      // i18n subpaths - must be before the shorter @alloomi/i18n alias
      {
        find: "@alloomi/i18n/locales",
        replacement: alias("../../packages/i18n/src/locales"),
      },
      {
        find: "@alloomi/i18n/*",
        replacement: alias("../../packages/i18n/src/*"),
      },
      {
        find: "@alloomi/i18n",
        replacement: alias("../../packages/i18n/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/calendar",
        replacement: alias("../../packages/integrations/calendar/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/calendar/*",
        replacement: alias("../../packages/integrations/calendar/src/*"),
      },
      {
        find: "@alloomi/integrations/hubspot",
        replacement: alias("../../packages/integrations/hubspot/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/hubspot/*",
        replacement: alias("../../packages/integrations/hubspot/src/*"),
      },
      {
        find: "@alloomi/indexeddb/extractor",
        replacement: alias("../../packages/indexeddb/src/extractor.ts"),
      },
      {
        find: "@alloomi/indexeddb/*",
        replacement: alias("../../packages/indexeddb/src/*"),
      },
      {
        find: "@alloomi/indexeddb",
        replacement: alias("../../packages/indexeddb/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/imessage",
        replacement: alias("../../packages/integrations/imessage/src/index.ts"),
      },
      {
        find: "@alloomi/shared/errors",
        replacement: alias("../../packages/shared/src/errors.ts"),
      },
      {
        find: "@alloomi/shared/ref",
        replacement: alias("../../packages/shared/src/ref.ts"),
      },
      {
        find: "@alloomi/shared/utils",
        replacement: alias("../../packages/shared/src/utils.ts"),
      },
      {
        find: "@alloomi/shared/soul",
        replacement: alias("../../packages/shared/src/soul.ts"),
      },
      {
        find: "@alloomi/shared/*",
        replacement: alias("../../packages/shared/src/*"),
      },
      {
        find: "@alloomi/shared",
        replacement: alias("../../packages/shared/src/index.ts"),
      },
      {
        find: "@alloomi/security/key-manager",
        replacement: alias("../../packages/security/src/key-manager.ts"),
      },
      {
        find: "@alloomi/security",
        replacement: alias("../../packages/security/src/index.ts"),
      },
      {
        find: "@alloomi/storage/adapters",
        replacement: alias("../../packages/storage/src/adapters"),
      },
      {
        find: "@alloomi/storage/adapters/local-fs",
        replacement: alias("../../packages/storage/src/adapters/local-fs.ts"),
      },
      {
        find: "@alloomi/storage/adapters/vercel-blob",
        replacement: alias(
          "../../packages/storage/src/adapters/vercel-blob.ts",
        ),
      },
      {
        find: "@alloomi/storage/*",
        replacement: alias("../../packages/storage/src/*"),
      },
      {
        find: "@alloomi/storage",
        replacement: alias("../../packages/storage/src/local.ts"),
      },
      {
        find: "@alloomi/integrations/channels",
        replacement: alias("../../packages/integrations/channels/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/contacts",
        replacement: alias("../../packages/integrations/src/contacts.ts"),
      },
      // Telegram integrations (specific paths first, then general)
      {
        find: "@alloomi/integrations/telegram/adapter",
        replacement: alias(
          "../../packages/integrations/telegram/src/adapter.ts",
        ),
      },
      {
        find: "@alloomi/integrations/telegram/markdown",
        replacement: alias(
          "../../packages/integrations/telegram/src/markdown.ts",
        ),
      },
      {
        find: "@alloomi/integrations/telegram/conversation-store",
        replacement: alias(
          "../../packages/integrations/telegram/src/conversation-store.ts",
        ),
      },
      {
        find: "@alloomi/integrations/telegram/tdata-decrypter",
        replacement: alias(
          "../../packages/integrations/telegram/src/tdata-decrypter/index.ts",
        ),
      },
      {
        find: "@alloomi/integrations/telegram/tdata-converter",
        replacement: alias(
          "../../packages/integrations/telegram/src/tdata-converter.ts",
        ),
      },
      {
        find: "@alloomi/integrations/telegram",
        replacement: alias("../../packages/integrations/telegram/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/whatsapp/adapter",
        replacement: alias(
          "../../packages/integrations/whatsapp/src/adapter.ts",
        ),
      },
      {
        find: "@alloomi/integrations/whatsapp/client-registry",
        replacement: alias(
          "../../packages/integrations/whatsapp/src/client-registry.ts",
        ),
      },
      {
        find: "@alloomi/integrations/whatsapp/conversation-store",
        replacement: alias(
          "../../packages/integrations/whatsapp/src/conversation-store.ts",
        ),
      },
      {
        find: "@alloomi/integrations/whatsapp/markdown",
        replacement: alias(
          "../../packages/integrations/whatsapp/src/markdown.ts",
        ),
      },
      {
        find: "@alloomi/integrations/whatsapp",
        replacement: alias("../../packages/integrations/whatsapp/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/asana",
        replacement: alias("../../packages/integrations/asana/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/dingtalk",
        replacement: alias("../../packages/integrations/dingtalk/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/facebook-messenger",
        replacement: alias(
          "../../packages/integrations/facebook-messenger/src/index.ts",
        ),
      },
      {
        find: "@alloomi/integrations/feishu",
        replacement: alias("../../packages/integrations/feishu/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/gmail",
        replacement: alias("../../packages/integrations/gmail/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/google-docs",
        replacement: alias(
          "../../packages/integrations/google-docs/src/index.ts",
        ),
      },
      {
        find: "@alloomi/integrations/instagram",
        replacement: alias(
          "../../packages/integrations/instagram/src/index.ts",
        ),
      },
      {
        find: "@alloomi/integrations/jira",
        replacement: alias("../../packages/integrations/jira/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/linkedin",
        replacement: alias("../../packages/integrations/linkedin/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/qqbot",
        replacement: alias("../../packages/integrations/qqbot/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/weixin/ilink-client",
        replacement: alias(
          "../../packages/integrations/weixin/src/ilink-client.ts",
        ),
      },
      {
        find: "@alloomi/integrations/weixin/conversation-store",
        replacement: alias(
          "../../packages/integrations/weixin/src/conversation-store.ts",
        ),
      },
      {
        find: "@alloomi/integrations/weixin/qr-login",
        replacement: alias(
          "../../packages/integrations/weixin/src/qr-login.ts",
        ),
      },
      {
        find: "@alloomi/integrations/weixin/ws-listener",
        replacement: alias(
          "../../packages/integrations/weixin/src/ws-listener.ts",
        ),
      },
      {
        find: "@alloomi/integrations/weixin",
        replacement: alias("../../packages/integrations/weixin/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/x",
        replacement: alias("../../packages/integrations/x/src/index.ts"),
      },
      {
        find: "@alloomi/integrations/utils",
        replacement: alias("../../packages/integrations/src/utils"),
      },
      {
        find: "@alloomi/integrations/core",
        replacement: alias("../../packages/integrations/src/core"),
      },
      {
        find: "@alloomi/integrations/*",
        replacement: alias("../../packages/integrations/src/*"),
      },
      {
        find: "@alloomi/integrations",
        replacement: alias("../../packages/integrations/src/index.ts"),
      },
      {
        find: "@alloomi/agent",
        replacement: alias("../../packages/ai/src/agent/index.ts"),
      },
      {
        find: "@alloomi/insights",
        replacement: alias("../../packages/insights/src/index.ts"),
      },
      {
        find: "@alloomi/rss",
        replacement: alias("../../packages/integrations/rss/src/index.ts"),
      },
      { find: "@", replacement: alias(".") },
    ],
  },
  test: {
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 20000,
    include: [
      "tests/unit/*.test.ts",
      "tests/api/*.test.ts",
      "tests/api/*.smoke.ts",
      "tests/benchmark/*.test.ts",
    ],
    exclude: ["node_modules", ".next", "out"],
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      reportsDirectory: "./coverage/unit",
    },
  },
});
