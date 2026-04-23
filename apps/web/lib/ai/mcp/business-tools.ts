/**
 * Business Tools MCP Server
 *
 * This module re-exports the business tools from the tools/ subfolder.
 * The actual implementation has been split into individual tool files
 * for better maintainability.
 *
 * @see tools/index.ts for the combined MCP server implementation
 */

export { createBusinessToolsMcpServer } from "./tools/index";
export type { InsightChangeCallback, TaskInput } from "./tools/shared";
export { INSIGHT_FILTER_KINDS } from "./tools/shared";
