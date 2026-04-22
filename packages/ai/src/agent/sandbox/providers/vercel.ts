/**
 * Vercel Sandbox Provider
 *
 * Uses Vercel Sandbox (@vercel/sandbox) for VM-isolated execution.
 */

import { extname } from "node:path";

import type {
  SandboxExecOptions,
  SandboxExecResult,
  ScriptOptions,
} from "../types";

import {
  BaseSandboxProvider,
  defineSandboxPlugin,
  detectRuntime,
} from "../plugin";

import type { SandboxPlugin, SandboxProviderMetadata } from "../types";

interface SandboxHandle {
  runCommand(options: {
    cmd: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
  }): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  [Symbol.asyncDispose](): Promise<void>;
}

interface VercelProviderConfig {
  teamId?: string;
  projectId?: string;
  token?: string;
  defaultTimeout?: number;
  runtime?: "node22" | "node24" | "python3.13";
  resources?: { vcpus: number };
  maxIdleTime?: number;
  maxInstances?: number;
  cleanupInterval?: number;
}

export class VercelProvider extends BaseSandboxProvider {
  readonly type = "vercel" as const;
  readonly name = "Vercel Sandbox";

  private sandboxes: Map<string, SandboxHandle> = new Map();
  private lastUsed: Map<string, number> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private providerConfig: VercelProviderConfig = {
    defaultTimeout: 300000,
    runtime: "node24",
    resources: { vcpus: 2 },
    maxIdleTime: 5 * 60 * 1000,
    maxInstances: 10,
    cleanupInterval: 60 * 1000,
  };

  async isAvailable(): Promise<boolean> {
    try {
      await import("@vercel/sandbox");
      return true;
    } catch {
      return false;
    }
  }

  async init(config?: Record<string, unknown>): Promise<void> {
    this.providerConfig = {
      defaultTimeout: 300000,
      runtime: "node24",
      resources: { vcpus: 2 },
      maxIdleTime: 5 * 60 * 1000,
      maxInstances: 10,
      cleanupInterval: 60 * 1000,
    };

    await super.init(config);

    if (config) {
      this.providerConfig = {
        ...this.providerConfig,
        ...(config as VercelProviderConfig),
      };
    }

    this.startCleanupTimer();
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleInstances().catch((err) => {
        console.error("[VercelProvider] Error cleaning up instances:", err);
      });
    }, this.providerConfig.cleanupInterval);

    this.cleanupTimer.unref();
  }

  private async cleanupIdleInstances(): Promise<void> {
    const now = Date.now();
    const maxIdleTime = this.providerConfig.maxIdleTime || 5 * 60 * 1000;
    const keysToClose: string[] = [];

    for (const [key, lastUsed] of this.lastUsed.entries()) {
      if (now - lastUsed > maxIdleTime) {
        keysToClose.push(key);
      }
    }

    for (const key of keysToClose) {
      await this.closeUserSandbox(key);
    }
  }

  private async enforceMaxInstances(): Promise<void> {
    const maxInstances = this.providerConfig.maxInstances || 10;

    if (this.sandboxes.size >= maxInstances) {
      let oldestKey: string | null = null;
      let oldestTime = Number.POSITIVE_INFINITY;

      for (const [key, lastUsed] of this.lastUsed.entries()) {
        if (lastUsed < oldestTime) {
          oldestTime = lastUsed;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        await this.closeUserSandbox(oldestKey);
      }
    }
  }

  private async getSandbox(userId?: string) {
    const key = userId || "default";

    const existing = this.sandboxes.get(key);
    if (existing) {
      this.lastUsed.set(key, Date.now());
      return existing;
    }

    await this.enforceMaxInstances();

    const { Sandbox } = await import("@vercel/sandbox");

    const createOptions: Record<string, unknown> = {
      resources: this.providerConfig.resources,
      timeout: this.providerConfig.defaultTimeout,
      runtime: this.providerConfig.runtime || "node24",
    };

    if (this.providerConfig.teamId) {
      createOptions.teamId = this.providerConfig.teamId;
    }
    if (this.providerConfig.projectId) {
      createOptions.projectId = this.providerConfig.projectId;
    }
    if (this.providerConfig.token) {
      createOptions.token = this.providerConfig.token;
    }

    const sandboxInstance = await Sandbox.create(createOptions);

    this.sandboxes.set(key, sandboxInstance as unknown as SandboxHandle);
    this.lastUsed.set(key, Date.now());

    return sandboxInstance as unknown as SandboxHandle;
  }

  async exec(options: SandboxExecOptions): Promise<SandboxExecResult> {
    const startTime = Date.now();
    const { command, args = [], cwd, env, timeout, userId } = options;

    try {
      const sandbox = await this.getSandbox(userId);

      const result = await sandbox.runCommand({
        cmd: command,
        args,
        cwd: undefined,
        env: env,
      });

      return {
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        exitCode: result.exitCode || 0,
        duration: Date.now() - startTime,
        provider: {
          type: this.type,
          name: this.name,
          isolation: "vm",
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        stdout: "",
        stderr: errorMessage,
        exitCode: -1,
        duration: Date.now() - startTime,
        provider: {
          type: this.type,
          name: this.name,
          isolation: "vm",
        },
      };
    }
  }

  async runScript(
    filePath: string,
    workDir: string,
    options?: ScriptOptions,
  ): Promise<SandboxExecResult> {
    const { runtime } = detectRuntime(filePath);
    const ext = extname(filePath).toLowerCase();

    let command = runtime;
    let args: string[] = [];
    const basename = filePath.split("/").pop() || "script";

    switch (ext) {
      case ".py":
        command = "python3";
        args = [`/vercel/sandbox/${basename}`];
        break;
      case ".ts":
        command = "npx";
        args = ["tsx", `/vercel/sandbox/${basename}`];
        break;
      case ".js":
        command = "node";
        args = [`/vercel/sandbox/${basename}`];
        break;
      case ".sh":
        command = "bash";
        args = [`/vercel/sandbox/${basename}`];
        break;
      default:
        command = "node";
        args = [`/vercel/sandbox/${basename}`];
    }

    if (options?.args) {
      args = [...args, ...options.args];
    }

    return this.exec({
      command,
      args,
      cwd: workDir,
      env: options?.env,
      timeout: options?.timeout || this.providerConfig.defaultTimeout || 300000,
      userId: options?.userId,
    });
  }

  getCapabilities() {
    return {
      supportsVolumeMounts: false,
      supportsNetworking: true,
      isolation: "vm" as const,
      supportedRuntimes: ["node22", "node24", "python3.13"],
      supportsPooling: false,
    };
  }

  async stop(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    for (const [userId, sandbox] of this.sandboxes.entries()) {
      try {
        await sandbox[Symbol.asyncDispose]();
      } catch (error) {
        console.error(
          `[VercelProvider] Error closing sandbox for user ${userId}:`,
          error,
        );
      }
    }
    this.sandboxes.clear();
    this.lastUsed.clear();

    await super.stop();
  }

  async closeUserSandbox(userId: string): Promise<void> {
    const sandbox = this.sandboxes.get(userId);
    if (sandbox) {
      try {
        await sandbox[Symbol.asyncDispose]();
      } catch {
        // ignore
      }
      this.sandboxes.delete(userId);
      this.lastUsed.delete(userId);
    }
  }
}

const VERCEL_METADATA: SandboxProviderMetadata = {
  type: "vercel",
  name: "Vercel Sandbox",
  description:
    "Uses Vercel Sandbox for hardware-isolated code execution in Firecracker MicroVMs.",
  version: "1.0.0",
  priority: 150,
  builtin: true,
  capabilities: {
    supportsVolumeMounts: false,
    supportsNetworking: true,
    isolation: "vm",
    supportedRuntimes: ["node22", "node24", "python3.13"],
    supportsPooling: false,
  },
  configSchema: {
    teamId: { type: "string", description: "Vercel Team ID" },
    projectId: { type: "string", description: "Vercel Project ID" },
    token: { type: "string", description: "Vercel API Token" },
    defaultTimeout: { type: "number", default: 300000 },
    runtime: {
      type: "string",
      default: "node24",
      enum: ["node22", "node24", "python3.13"],
    },
    resources: {
      type: "object",
      properties: {
        vcpus: { type: "number", minimum: 1, maximum: 8, default: 2 },
      },
    },
  },
};

export const vercelPlugin: SandboxPlugin = defineSandboxPlugin({
  metadata: VERCEL_METADATA,
  factory: () => new VercelProvider(),
});

export function createVercelProvider(): VercelProvider {
  return new VercelProvider();
}
