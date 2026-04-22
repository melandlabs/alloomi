---
name: alloomi-brave-search
description: "Automatically use when the user asks about real-time information, latest news, web search, current prices, competitor info, current events, weather, stock prices, or tech trends. No need to say 'use search' — triggers by intent. Supports web search and news search with automatic credit deduction."
metadata:
  version: 0.4.2
allowed-tools: Bash(node $SKILL_DIR/scripts/alloomi-search.cjs *)
---

# Alloomi Brave Search Skill

## Overview

Call Brave Search (web search and news search) through Alloomi cloud at `https://app.alloomi.ai/api/brave-search`. Automatically triggers when the user asks about real-time information, latest news, current prices, competitor info, events, weather, stock prices, tech trends, or anything requiring up-to-date information from the internet.

## Authentication

The CLI auto-reads your token from a local file (written by the Alloomi app after login):

- **macOS / Linux / Windows**: `~/.alloomi/token` (base64 encoded)

When you log in via the Alloomi desktop app, the token is automatically saved to this file.
If no token is found, the CLI will prompt for email and password:

```bash
node $SKILL_DIR/scripts/alloomi-search.cjs login <email> <password>
```

## Credit Costs

| Search Type | Results | Credits |
|-------------|---------|---------|
| web search  | 5       | 50      |
| web search  | 10      | 80      |
| news search | 5       | 60      |
| news search | 10      | 100     |

---

## CLI Script

```bash
chmod +x skills/alloomi-brave-search/alloomi-search.cjs
```

### Quick Start

```bash
# First time — login
node $SKILL_DIR/scripts/alloomi-search.cjs login user@example.com mypassword

# Web search (default, 10 results)
node $SKILL_DIR/scripts/alloomi-search.cjs search "latest AI news"

# Web search with custom count
node $SKILL_DIR/scripts/alloomi-search.cjs search "AI news" --count 5

# News search
node $SKILL_DIR/scripts/alloomi-search.cjs search "AI news" --type news

# News search with custom count
node $SKILL_DIR/scripts/alloomi-search.cjs search "AI news" --type news --count 5
```

---

## Curl Examples

### Web search (default, 10 results)

```bash
curl -s -X POST https://app.alloomi.ai/api/brave-search \
  -H "Authorization: Bearer $ALLOOMI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "latest AI news", "type": "web", "count": 10}' \
  | jq .
```

### News search

```bash
curl -s -X POST https://app.alloomi.ai/api/brave-search \
  -H "Authorization: Bearer $ALLOOMI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "AI news", "type": "news", "count": 5}' \
  | jq .
```

---

## Error Handling

| HTTP | code | Meaning | User message |
|------|------|---------|--------------|
| 400 | — | Missing query | "Missing required parameter: query" |
| 400 | — | Invalid type | "Invalid type. Must be 'web' or 'news'." |
| 401 | — | Alloomi token expired | "Token expired. Please login again." |
| 403 | `INSUFFICIENT_CREDITS` | Not enough credits | "Insufficient credits. Please top up at alloomi.ai." |
| 429 | — | Rate limit | "Too many requests. Wait a moment and try again." |
| 500 | `SEARCH_ERROR` | API error | "Search error: {message}. Try again later." |

---

## AI Agent Workflow

When a user asks something that requires real-time or web-based information:

1. **Identify** the intent — does it need current news, prices, events, or general web info?
2. **Choose search type**:
   - News/current events → use `--type news`
   - General web search → use `--type web` (default)
3. **Choose result count** (default 10, use 5 if asking for a quick summary)
4. **Run** using the Bash tool:

   ```bash
   node $SKILL_DIR/scripts/alloomi-search.cjs search "user query" --type web --count 10
   ```

5. **Report result** naturally in the user's language:
   - Summarize top results with titles and links
   - Include credit usage: "Used 80 credits for 10 web results"
   - On error → explain the error and suggest a fix
6. **Hide raw JSON** — format responses naturally
