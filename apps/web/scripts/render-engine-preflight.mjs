import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const defaultManifestPath = path.resolve(
  __dirname,
  "../src-tauri/resources/render-engine-manifest.json",
);

export function getCurrentPlatformKey(
  platform = process.platform,
  arch = process.arch,
) {
  if (platform === "darwin") {
    return arch === "arm64" ? "darwin-arm64" : "darwin-x64";
  }
  if (platform === "linux") {
    return arch === "x64" ? "linux-x64" : "unknown";
  }
  if (platform === "win32") {
    return arch === "arm64" ? "windows-arm64" : "windows-x64";
  }
  return "unknown";
}

export function getRenderEngineAssetName(platformKey) {
  if (platformKey === "unknown") {
    throw new Error("Unsupported platform for render engine packaging");
  }
  return platformKey.startsWith("windows-")
    ? `render-engine-${platformKey}.zip`
    : `render-engine-${platformKey}.tar.gz`;
}

export function loadRenderEngineManifest(manifestPath = defaultManifestPath) {
  const raw = fs.readFileSync(manifestPath, "utf8");
  return JSON.parse(raw);
}

export function resolveRenderEngineDownloadSpec(
  manifest,
  platformKey = getCurrentPlatformKey(),
) {
  if (platformKey === "unknown") {
    throw new Error("Unsupported platform for render engine packaging");
  }

  const version = manifest?.version;
  const platforms = manifest?.platforms;
  const platformSpec = platforms?.[platformKey];

  if (!version || typeof version !== "string") {
    throw new Error("render-engine manifest is missing version");
  }

  if (!platformSpec || typeof platformSpec !== "object") {
    throw new Error(
      `render-engine manifest does not contain platform ${platformKey}`,
    );
  }

  if (!platformSpec.url || typeof platformSpec.url !== "string") {
    throw new Error(
      `render-engine manifest platform ${platformKey} is missing url`,
    );
  }

  const archiveName =
    typeof platformSpec.archiveName === "string" && platformSpec.archiveName
      ? platformSpec.archiveName
      : getRenderEngineAssetName(platformKey);

  return {
    version,
    archiveName,
    url: platformSpec.url,
    sha256:
      typeof platformSpec.sha256 === "string" ? platformSpec.sha256 : null,
  };
}

export async function verifyDownloadUrl(url, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    let response = await fetchImpl(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });

    if (
      response.status === 405 ||
      response.status === 403 ||
      response.status === 404
    ) {
      response = await fetchImpl(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
        signal: controller.signal,
      });
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function runRenderEnginePreflight({
  manifestPath = defaultManifestPath,
  fetchImpl = fetch,
} = {}) {
  const platformKey = getCurrentPlatformKey();
  if (platformKey === "unknown") {
    return;
  }

  const manifest = loadRenderEngineManifest(manifestPath);
  const spec = resolveRenderEngineDownloadSpec(manifest, platformKey);
  await verifyDownloadUrl(spec.url, fetchImpl);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runRenderEnginePreflight()
    .then(() => {
      console.log(
        `[render-engine-preflight] OK for ${os.platform()} ${os.arch()}`,
      );
    })
    .catch((error) => {
      console.error(
        `[render-engine-preflight] Failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    });
}
