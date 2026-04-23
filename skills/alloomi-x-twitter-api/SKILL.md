---
name: alloomi-x-twitter-api
description: "Use X (Twitter) APIs via Alloomi cloud. Call this when the user wants to post tweets, search, reply, retweet, like, get timeline, notifications, or profile. Triggers: post tweet, search tweets, retweet, like, timeline, notifications, X operation"
metadata:
  version: 0.4.3
allowed-tools: Bash(node $SKILL_DIR/scripts/alloomi-x.cjs *)
---

# Alloomi X (Twitter) API Skill

## Overview

Call X (Twitter) APIs through Alloomi cloud at `https://app.alloomi.ai/api/x`. Requires the user to be logged into Alloomi with X connected via Settings > Integrations.

## Authentication

The CLI auto-reads your token from a local file (written by the Alloomi app after login):

- **macOS / Linux / Windows**: `~/.alloomi/token` (base64 encoded)

When you log in via the Alloomi desktop app, the token is automatically saved to this file.
If no token is found, the CLI will prompt for email and password, or you can login manually:

```bash
node $SKILL_DIR/scripts/alloomi-x.cjs login <email> <password>
# e.g.
node $SKILL_DIR/scripts/alloomi-x.cjs login user@example.com mypassword
```

Run `chmod +x` on the script to make it directly executable.

## Credit Costs

| Operation | Credits |
|-----------|---------|
| postTweet | 150 |
| postTweetWithMedia | 200 |
| getTimeline | 50 |
| searchTweets | 80 |
| getNotifications | 50 |
| replyTo | 100 |
| retweet | 30 |
| likeTweet | 20 |
| getProfile | 10 |

---

## CLI Script

```bash
chmod +x skills/alloomi-x-twitter-api/alloomi-x.cjs
```

### Quick Start

```bash
# First time — login
node $SKILL_DIR/scripts/alloomi-x.cjs login user@example.com mypassword

# Post a tweet
node $SKILL_DIR/scripts/alloomi-x.cjs postTweet "Hello from Alloomi!"

# Search tweets
node $SKILL_DIR/scripts/alloomi-x.cjs searchTweets "AI news"

# Reply
node $SKILL_DIR/scripts/alloomi-x.cjs replyTo 1234567890 "Great post!"

# Retweet
node $SKILL_DIR/scripts/alloomi-x.cjs retweet 1234567890

# Like
node $SKILL_DIR/scripts/alloomi-x.cjs likeTweet 1234567890

# Get timeline
node $SKILL_DIR/scripts/alloomi-x.cjs getTimeline 20

# Get profile
node $SKILL_DIR/scripts/alloomi-x.cjs getProfile

# Get notifications
node $SKILL_DIR/scripts/alloomi-x.cjs getNotifications 20
```

Run with `--help` for full usage:

```bash
node $SKILL_DIR/scripts/alloomi-x.cjs --help
```

---

## Curl Examples

### postTweet

```bash
curl -s -X POST https://app.alloomi.ai/api/x \
  -H "Authorization: Bearer $ALLOOMI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operation": "postTweet", "params": {"text": "Hello from Alloomi!"}}' \
  | jq .
```

### getTimeline

```bash
curl -s -X POST https://app.alloomi.ai/api/x \
  -H "Authorization: Bearer $ALLOOMI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operation": "getTimeline", "params": {"maxResults": 20}}' \
  | jq .
```

### searchTweets

```bash
curl -s -X POST https://app.alloomi.ai/api/x \
  -H "Authorization: Bearer $ALLOOMI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operation": "searchTweets", "params": {"query": "AI news", "maxResults": 20}}' \
  | jq .
```

### replyTo

```bash
curl -s -X POST https://app.alloomi.ai/api/x \
  -H "Authorization: Bearer $ALLOOMI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operation": "replyTo", "params": {"tweetId": "1234567890", "text": "Great post!"}}' \
  | jq .
```

### retweet

```bash
curl -s -X POST https://app.alloomi.ai/api/x \
  -H "Authorization: Bearer $ALLOOMI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operation": "retweet", "params": {"tweetId": "1234567890"}}' \
  | jq .
```

### likeTweet

```bash
curl -s -X POST https://app.alloomi.ai/api/x \
  -H "Authorization: Bearer $ALLOOMI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operation": "likeTweet", "params": {"tweetId": "1234567890"}}' \
  | jq .
```

### getProfile

```bash
curl -s -X POST https://app.alloomi.ai/api/x \
  -H "Authorization: Bearer $ALLOOMI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operation": "getProfile", "params": {}}' \
  | jq .
```

### getNotifications

```bash
curl -s -X POST https://app.alloomi.ai/api/x \
  -H "Authorization: Bearer $ALLOOMI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operation": "getNotifications", "params": {"maxResults": 20}}' \
  | jq .
```

---

## Error Handling

| HTTP | code | Meaning | User message |
|------|------|---------|--------------|
| 400 | `X_NOT_CONNECTED` | X not linked in Settings | "Please connect X in Settings > Integrations first." |
| 401 | `X_TOKEN_EXPIRED` | X OAuth token expired | "X access token expired. Please reconnect X in Settings > Integrations." |
| 403 | `INSUFFICIENT_CREDITS` | Not enough credits | "Insufficient credits. Please top up at alloomi.ai." |
| 401 | — | Alloomi token expired | "Token expired. Please login again: node $SKILL_DIR/scripts/alloomi-x.cjs login <email> <password>" |
| 429 | — | Rate limit | "Too many requests. Wait a moment and try again." |
| 500 | — | API error | "X API error: {message}. Try again later." |

---

## AI Agent Workflow

When a user asks for an X operation:

1. **Identify** the operation and required params
2. **Run** using the Bash tool: `node $SKILL_DIR/scripts/alloomi-x.cjs <operation> [args...]`
   - If not logged in, the CLI will prompt for email/password automatically
3. **Report result** naturally:
   - postTweet success → "Tweet posted! Used 150 credits. https://x.com/..."
   - getTimeline → summarize top tweets
   - searchTweets → list top 5 results with links
   - error → explain the error and resolution
4. **Hide raw JSON** — format responses naturally in the user's language
