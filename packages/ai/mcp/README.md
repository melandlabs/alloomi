# @alloomi/mcp

Model Context Protocol (MCP) server configuration types and loader.

## Installation

```sh
pnpm add @alloomi/mcp
```

## Usage

```ts
import { loadMcpServers, getMcpConfigPath } from "@alloomi/mcp";

// Load MCP servers from ~/.alloomi/mcp.json
const servers = await loadMcpServers();
```

## Configuration

By default, reads from `~/.alloomi/mcp.json`. Override with `ALLOOMI_MCP_CONFIG_PATH` environment variable.
