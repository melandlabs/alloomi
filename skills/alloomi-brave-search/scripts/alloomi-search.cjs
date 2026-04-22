/**
 * Alloomi Brave Search CLI
 *
 * Call Brave Search (web & news) through Alloomi cloud at https://app.alloomi.ai
 *
 * Auth: Token stored at ~/.alloomi/token (base64 encoded)
 *
 * Usage:
 *   node alloomi-search.cjs login <email> <password>
 *   node alloomi-search.cjs search <query> [--type web|news] [--count N]
 *
 * Examples:
 *   node alloomi-search.cjs login user@example.com mypassword
 *   node alloomi-search.cjs search "latest AI news"
 *   node alloomi-search.cjs search "AI news" --type news
 *   node alloomi-search.cjs search "AI news" --type news --count 5
 *   node alloomi-search.cjs search "AI news" --count 5
 */

// ── Node.js built-ins ──────────────────────────────────────────────────────────
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const http = require("node:http");

const API_BASE = "https://app.alloomi.ai";
const TOKEN_FILE = path.join(os.homedir(), ".alloomi", "token");

// ── Token storage ─────────────────────────────────────────────────────────────

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

// ── HTTP helpers ───────────────────────────────────────────────────────────────

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

async function api(method, urlPath, body) {
  const token = loadToken();
  if (!token) {
    throw new Error("No token found. Please login first.");
  }
  const res = await request(method, urlPath, body, {
    Authorization: `Bearer ${token}`,
  });
  if (res.status === 401) {
    throw new Error("Token expired. Please login again.");
  }
  if (res.status < 200 || res.status >= 300) {
    const msg =
      res.body?.error ||
      res.body?.message ||
      JSON.stringify(res.body);
    throw new Error(`API error ${res.status}: ${msg}`);
  }
  return res.body;
}

// ── Operations ─────────────────────────────────────────────────────────────────

async function login(email, password) {
  const res = await request("POST", "/api/remote-auth/login", {
    email,
    password,
  });
  if (res.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  }
  if (!res.body.token) {
    throw new Error("Login failed: no token returned");
  }
  if (!saveToken(res.body.token)) {
    throw new Error("Failed to save token");
  }
  console.log("[Alloomi Brave Search] Login successful, token saved.");
}

async function braveSearch(query, type = "web", count = 10) {
  return api("POST", "/api/brave-search", { query, type, count });
}

// ── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const [op, ...rest] = args;

  if (!op) {
    console.log(`Alloomi Brave Search CLI - Usage:
  node alloomi-search.cjs login <email> <password>
  node alloomi-search.cjs search <query> [--type web|news] [--count N]

Examples:
  node alloomi-search.cjs login user@example.com mypassword
  node alloomi-search.cjs search "latest AI news"
  node alloomi-search.cjs search "AI news" --type news
  node alloomi-search.cjs search "AI news" --type news --count 5
  node alloomi-search.cjs search "AI news" --count 5`);
    process.exit(0);
  }

  if (op === "login") {
    await login(rest[0], rest[1]);
    process.exit(0);
  }

  if (op === "search") {
    // Parse: search <query> [--type web|news] [--count N]
    const queryParts = [];
    let type = "web";
    let count = 10;

    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i];
      if (arg === "--type" && i + 1 < rest.length) {
        type = rest[++i];
      } else if (arg === "--count" && i + 1 < rest.length) {
        count = Number.parseInt(rest[++i], 10);
      } else {
        queryParts.push(arg);
      }
    }

    const query = queryParts.join(" ");
    if (!query) {
      console.error("[Alloomi Brave Search] Error: query is required.");
      process.exit(1);
    }

    try {
      const result = await braveSearch(query, type, count);
      // Output clean JSON for agent consumption
      process.stdout.write(JSON.stringify(result, null, 2));
    } catch (e) {
      console.error("[Alloomi Brave Search] Error:", e.message);
      process.exit(1);
    }
    process.exit(0);
  }

  console.error(`Unknown operation: ${op}`);
  console.error("Available: login, search");
  process.exit(1);
}

main();
