import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cwd = path.resolve(__dirname, "..");
const scriptsDir = path.resolve(__dirname);

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: "inherit",
      shell: true,
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed: ${cmd} ${args.join(" ")}`));
    });
  });
}

async function main() {
  const env = { IS_TAURI: "true" };

  console.log("[1/3] Creating dev standalone...");
  await run("node", [path.join(scriptsDir, "create-dev-standalone.js")], env);

  console.log("[2/3] Bundling runtime...");
  await run("pnpm", ["--filter", "web", "bundle:runtime"], env);

  console.log("[3/3] Starting dev server...");
  await run("pnpm", ["--filter", "web", "dev"], {
    ...env,
    NODE_OPTIONS: `--require ${path.join(scriptsDir, "patch-http-timeout.cjs")}`,
    PORT: "3515",
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
