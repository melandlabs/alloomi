/**
 * Alloomi X (Twitter) API CLI
 *
 * Call X (Twitter) APIs through Alloomi cloud at https://app.alloomi.ai
 *
 * Auth: Token stored at ~/.alloomi/token (base64 encoded)
 *
 * If no token found, prompts for email/password to login.
 *
 * Usage:
 *   node alloomi-x.cjs <operation> [args...]
 *
 * Operations:
 *   login <email> <password>            - Login and save token
 *   postTweet <text>                    - Post a tweet (150 credits)
 *   postTweetWithMedia <text> <ids...> - Post with media (200 credits)
 *   getTimeline [maxResults]             - Get home timeline (50 credits, default 20)
 *   searchTweets <query> [maxResults]   - Search tweets (80 credits)
 *   getNotifications [maxResults]        - Get notifications (50 credits)
 *   replyTo <tweetId> <text>           - Reply to a tweet (100 credits)
 *   retweet <tweetId>                  - Retweet (30 credits)
 *   likeTweet <tweetId>                 - Like a tweet (20 credits)
 *   getProfile                          - Get your profile (10 credits)
 *
 * Examples:
 *   node alloomi-x.cjs login user@example.com mypassword
 *   node alloomi-x.cjs postTweet "Hello from Alloomi!"
 *   node alloomi-x.cjs searchTweets "AI news"
 *   node alloomi-x.cjs replyTo 1234567890 "Great post!"
 *   node alloomi-x.cjs retweet 1234567890
 *   node alloomi-x.cjs getProfile
 *   node alloomi-x.cjs getTimeline 10
 */

// ── Node.js built-ins ──────────────────────────────────────────────────────────
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const http = require("node:http");

const API_BASE = "https://app.alloomi.ai";
const TOKEN_FILE = path.join(os.homedir(), ".alloomi", "token");

// ── Token storage (unified file base64) ────────────────────────────────────────────

function loadToken() {
  try {
    const encoded = fs.readFileSync(TOKEN_FILE, "utf8").trim();
    if (!encoded) return null;
    return Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function saveToken(token) {
  try {
    const dir = path.dirname(TOKEN_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const encoded = Buffer.from(token).toString("base64");
    fs.writeFileSync(TOKEN_FILE, encoded, { mode: 0o600 });
    return true;
  } catch (e) {
    console.error("[Token] Failed to save:", e.message);
    return false;
  }
}

function deleteToken() {
  try { fs.unlinkSync(TOKEN_FILE); } catch {}
}

// ── HTTP helpers ────────────────────────────────────────────────────────────────

function request(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + urlPath);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json", ...headers },
    };

    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── API helpers ────────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const token = loadToken();
  if (!token) {
    throw new Error("No token found. Please login first.");
  }
  const res = await request(method, path, body, { Authorization: `Bearer ${token}` });
  if (res.status === 401) {
    throw new Error("X Access Token expired. Please unbind the X integration and connect it again.");
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`API error ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

// ── X integration check ────────────────────────────────────────────────────────

async function checkXIntegration() {
  try {
    const res = await api("GET", "/api/integrations/accounts");
    const xAccount = res.accounts?.find((a) => a.platform === "twitter");
    if (!xAccount) {
      console.error("[Alloomi X] X integration not connected.");
      console.error("Please go to Alloomi app → Settings → Integrations → Connect X.");
      process.exit(1);
    }
    return xAccount;
  } catch (e) {
    console.error("[Alloomi X] Integration check failed:", e.message);
    process.exit(1);
  }
}

// ── Operations ────────────────────────────────────────────────────────────────

async function login(email, password) {
  const res = await request("POST", "/api/remote-auth/login", { email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  }
  if (!res.body.token) {
    throw new Error("Login failed: no token returned");
  }
  if (!saveToken(res.body.token)) {
    throw new Error("Failed to save token");
  }
  console.log("[Alloomi X] Login successful, token saved.");
}

async function postTweet(text) {
  await checkXIntegration();
  return api("POST", "/api/x", { operation: "postTweet", params: { text } });
}

async function postTweetWithMedia(text, mediaIds) {
  await checkXIntegration();
  return api("POST", "/api/x", { operation: "postTweet", params: { text, mediaIds } });
}

async function getTimeline(maxResults = 20) {
  await checkXIntegration();
  return api("POST", "/api/x", { operation: "getTimeline", params: { maxResults } });
}

async function searchTweets(query, maxResults = 10) {
  await checkXIntegration();
  return api("POST", "/api/x", { operation: "searchTweets", params: { query, maxResults } });
}

async function getNotifications(maxResults = 20) {
  await checkXIntegration();
  return api("POST", "/api/x", { operation: "getNotifications", params: { maxResults } });
}

async function replyTo(tweetId, text) {
  await checkXIntegration();
  return api("POST", "/api/x", { operation: "replyTo", params: { tweetId, text } });
}

async function retweet(tweetId) {
  await checkXIntegration();
  return api("POST", "/api/x", { operation: "retweet", params: { tweetId } });
}

async function likeTweet(tweetId) {
  await checkXIntegration();
  return api("POST", "/api/x", { operation: "likeTweet", params: { tweetId } });
}

async function getProfile() {
  await checkXIntegration();
  return api("POST", "/api/x", { operation: "getProfile", params: {} });
}

async function followUser(userId) {
  await checkXIntegration();
  return api("POST", "/api/x", { operation: "followUser", params: { userId } });
}

async function unfollowUser(userId) {
  await checkXIntegration();
  return api("POST", "/api/x", { operation: "unfollowUser", params: { userId } });
}

async function getUserTweets(userId, maxResults = 10) {
  await checkXIntegration();
  return api("POST", "/api/x", { operation: "getUserTweets", params: { userId, maxResults } });
}

// ── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const [op, ...args] = process.argv.slice(2);

  if (!op) {
    console.log(`Alloomi X CLI - Usage:
  node alloomi-x.cjs login <email> <password>
  node alloomi-x.cjs postTweet <text>
  node alloomi-x.cjs postTweetWithMedia <text> <mediaId1> [mediaId2...]
  node alloomi-x.cjs getTimeline [maxResults]
  node alloomi-x.cjs searchTweets <query> [maxResults]
  node alloomi-x.cjs getNotifications [maxResults]
  node alloomi-x.cjs replyTo <tweetId> <text>
  node alloomi-x.cjs retweet <tweetId>
  node alloomi-x.cjs likeTweet <tweetId>
  node alloomi-x.cjs getProfile
  node alloomi-x.cjs followUser <userId>
  node alloomi-x.cjs unfollowUser <userId>
  node alloomi-x.cjs getUserTweets <userId> [maxResults]`);
    process.exit(0);
  }

  try {
    let result;
    switch (op) {
      case "login":
        [result] = args;
        await login(args[0], args[1]);
        break;
      case "postTweet":
        result = await postTweet(args.join(" "));
        break;
      case "postTweetWithMedia": {
        const text = args[0];
        const mediaIds = args.slice(1);
        result = await postTweetWithMedia(text, mediaIds);
        break;
      }
      case "getTimeline":
        result = await getTimeline(Number(args[0]) || 20);
        break;
      case "searchTweets":
        result = await searchTweets(args[0], Number(args[1]) || 10);
        break;
      case "getNotifications":
        result = await getNotifications(Number(args[0]) || 20);
        break;
      case "replyTo":
        result = await replyTo(args[0], args.slice(1).join(" "));
        break;
      case "retweet":
        result = await retweet(args[0]);
        break;
      case "likeTweet":
        result = await likeTweet(args[0]);
        break;
      case "getProfile":
        result = await getProfile();
        break;
      case "followUser":
        result = await followUser(args[0]);
        break;
      case "unfollowUser":
        result = await unfollowUser(args[0]);
        break;
      case "getUserTweets":
        result = await getUserTweets(args[0], Number(args[1]) || 10);
        break;
      default:
        console.error(`Unknown operation: ${op}`);
        process.exit(1);
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("[Alloomi X] Error:", e.message);
    process.exit(1);
  }
}

main();
