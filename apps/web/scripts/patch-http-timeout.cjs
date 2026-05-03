// preload script: patch Node.js http module to extend server timeouts before Next.js starts
// This fixes the 60s headersTimeout issue that kills long API requests in dev mode.
// Usage: NODE_OPTIONS="--require /path/to/patch-http-timeout.cjs" pnpm dev

const http = require("node:http");
const https = require("node:https");

const TIMEOUT = 600000; // 10min

(function patch() {
  // Guard against multiple requires (e.g., from Turbopack workers or nested processes)
  if (http.createServer.__patched) {
    return;
  }
  http.createServer.__patched = true;
  https.createServer.__patched = true;

  function patchServer(server) {
    if (server && typeof server === "object") {
      server.timeout = TIMEOUT;
      server.headersTimeout = TIMEOUT;
    }
    return server;
  }

  // Patch http.createServer
  const originalHttpCreateServer = http.createServer;
  http.createServer = (...args) => patchServer(originalHttpCreateServer.apply(this, args));

  // Patch https.createServer
  const originalHttpsCreateServer = https.createServer;
  https.createServer = (...args) => patchServer(originalHttpsCreateServer.apply(this, args));

  // Patch http.Server constructor — catches `new http.Server()` calls
  const OriginalHttpServer = http.Server;
  http.Server = (...args) => patchServer(new OriginalHttpServer(...args));
  http.Server.prototype = OriginalHttpServer.prototype;

  // Patch https.Server constructor — catches `new https.Server()` calls
  const OriginalHttpsServer = https.Server;
  https.Server = (...args) => patchServer(new OriginalHttpsServer(...args));
  https.Server.prototype = OriginalHttpsServer.prototype;
})();
