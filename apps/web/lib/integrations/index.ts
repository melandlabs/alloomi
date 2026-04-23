/**
 * Integration module barrel export — CLIENT-SAFE SUBSET ONLY.
 *
 * Server-only modules are NOT re-exported here to prevent client bundles
 * from pulling in Node.js/Redis dependencies. Import them directly from
 * their specific paths in server-only contexts (API routes, server components).
 *
 * Client-safe:
 *   ./oauth         — OAuth URL generators (client-side fetch calls)
 *   ./entities      — types only
 *   ./sources/types — types only
 *   ./client        — client-safe integration account helpers
 *
 * Server-only (do NOT import via this barrel):
 *   ./state-manager — ioredis/Redis
 *   ./adapter       — MessagePlatformAdapter (runtime implementation)
 *   ./events        — runtime event handlers
 *   ./message       — runtime message handlers
 *   ./cloud-sync    — auth token manager
 *   ./rss-client    — auth token manager
 */

// Client-safe re-exports only
export * from "./oauth";

export type {
  IntegrationId,
  CreateIntegrationAccountPayload,
  CreatedIntegrationAccount,
} from "./client";
